import "server-only";

import type { SiteMonitor } from "@prisma/client";
import { db } from "@/lib/db";
import { sendSiteDownEmail, sendSiteUpEmail } from "@/lib/emails";
import { formatDuration } from "@/lib/duration";

const CHECK_TIMEOUT_MS = 15_000;
// Ré-alerte au plus toutes les 6 h tant que le site reste down.
const REALERT_EVERY_MS = 6 * 60 * 60 * 1000;

type PingResult = {
  up: boolean;
  statusCode: number | null;
  error: string | null;
  responseMs: number;
};

async function pingUrl(url: string): Promise<PingResult> {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { "user-agent": "backoffice-monitor/1.0" },
    });
    return {
      up: res.status < 400,
      statusCode: res.status,
      error: null,
      responseMs: Date.now() - startedAt,
    };
  } catch (e) {
    const error =
      e instanceof Error
        ? e.name === "TimeoutError"
          ? `Timeout après ${CHECK_TIMEOUT_MS / 1000} s`
          : (e.cause instanceof Error ? e.cause.message : e.message)
        : String(e);
    return { up: false, statusCode: null, error, responseMs: Date.now() - startedAt };
  }
}

type Target = {
  projectId: string | null;
  monitorId: string | null;
  name: string;
  clientName: string | null;
  url: string;
  monitor: SiteMonitor | null;
};

/** Sites surveillés : projets avec URL + sites ajoutés à la main. */
async function getTargets(): Promise<Target[]> {
  const [projects, customs] = await Promise.all([
    db.project.findMany({
      where: { url: { not: null } },
      select: {
        id: true,
        name: true,
        url: true,
        client: { select: { name: true } },
        monitor: true,
      },
    }),
    db.siteMonitor.findMany({ where: { projectId: null } }),
  ]);
  return [
    ...projects.map((p) => ({
      projectId: p.id,
      monitorId: p.monitor?.id ?? null,
      name: p.name,
      clientName: p.client.name,
      url: p.url!,
      monitor: p.monitor,
    })),
    ...customs
      .filter((m) => m.url)
      .map((m) => ({
        projectId: null,
        monitorId: m.id,
        name: m.label ?? m.url!,
        clientName: null,
        url: m.url!,
        monitor: m,
      })),
  ];
}

async function saveState(target: Target, data: Partial<SiteMonitor>) {
  if (target.projectId) {
    await db.siteMonitor.upsert({
      where: { projectId: target.projectId },
      create: { projectId: target.projectId, ...data },
      update: data,
    });
  } else if (target.monitorId) {
    await db.siteMonitor.update({ where: { id: target.monitorId }, data });
  }
}

/**
 * Ping tous les sites surveillés (monitoring non désactivé) et met à jour
 * leur état. Alerte l'admin par email quand un site tombe (puis toutes les
 * 6 h) et quand il est rétabli.
 */
export async function runSiteChecks(now = new Date()) {
  const targets = (await getTargets()).filter(
    (t) => t.monitor?.enabled !== false && t.monitor?.hidden !== true
  );

  const timeFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  let down = 0;
  await Promise.all(
    targets.map(async (t) => {
      const r = await pingUrl(t.url);
      const prev = t.monitor;
      const wasDown = prev?.status === "DOWN";

      if (r.up) {
        if (wasDown && prev?.downSince) {
          await sendSiteUpEmail({
            projectName: t.name,
            clientName: t.clientName ?? "site perso",
            url: t.url,
            downtime: formatDuration(now.getTime() - prev.downSince.getTime()),
          });
        }
        await saveState(t, {
          status: "UP",
          lastCheckedAt: now,
          lastStatusCode: r.statusCode,
          lastError: null,
          responseMs: r.responseMs,
          lastOkAt: now,
          downSince: null,
          lastAlertAt: null,
        });
        return;
      }

      down++;
      const downSince = wasDown && prev?.downSince ? prev.downSince : now;
      const shouldAlert =
        !wasDown ||
        !prev?.lastAlertAt ||
        now.getTime() - prev.lastAlertAt.getTime() > REALERT_EVERY_MS;
      if (shouldAlert) {
        await sendSiteDownEmail({
          projectName: t.name,
          clientName: t.clientName ?? "site perso",
          url: t.url,
          detail: r.statusCode ? `HTTP ${r.statusCode}` : (r.error ?? "erreur inconnue"),
          downSince: timeFmt.format(downSince),
        });
      }
      await saveState(t, {
        status: "DOWN",
        lastCheckedAt: now,
        lastStatusCode: r.statusCode,
        lastError: r.error,
        responseMs: r.responseMs,
        downSince,
        ...(shouldAlert ? { lastAlertAt: now } : {}),
      });
    })
  );

  return { checked: targets.length, down };
}

/** État de tous les sites (page monitoring + KPI dashboard) — ADMIN uniquement. */
export async function getMonitoringOverview() {
  const targets = await getTargets();

  // Projets retirés du monitoring (réaffichables depuis la page).
  const hiddenSites = targets
    .filter((t) => t.monitor?.hidden === true)
    .map((t) => ({
      projectId: t.projectId!,
      name: t.name,
      clientName: t.clientName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const sites = targets
    .filter((t) => t.monitor?.hidden !== true)
    .map((t) => ({
      key: t.monitorId ?? t.projectId!,
      projectId: t.projectId,
      monitorId: t.monitorId,
      custom: t.projectId === null,
      name: t.name,
      clientName: t.clientName,
      url: t.url,
      enabled: t.monitor?.enabled !== false,
      status: t.monitor?.status ?? ("UNKNOWN" as const),
      lastCheckedAt: t.monitor?.lastCheckedAt ?? null,
      lastStatusCode: t.monitor?.lastStatusCode ?? null,
      lastError: t.monitor?.lastError ?? null,
      responseMs: t.monitor?.responseMs ?? null,
      downSince: t.monitor?.downSince ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const active = sites.filter((s) => s.enabled);
  return {
    sites,
    hiddenSites,
    monitored: active.length,
    up: active.filter((s) => s.status === "UP").length,
    down: active.filter((s) => s.status === "DOWN").length,
  };
}
