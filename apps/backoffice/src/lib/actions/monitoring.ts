"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { runSiteChecks } from "@/lib/services/monitoring";

/** Lance une vérification immédiate de tous les sites surveillés. */
export async function runSiteChecksAction() {
  await requireAdmin();
  const result = await runSiteChecks();
  revalidatePath("/admin/monitoring");
  return { ok: true, ...result };
}

const addSiteSchema = z.object({
  label: z.string().trim().min(1, "Nom requis.").max(80),
  url: z
    .string()
    .trim()
    .url("URL invalide — inclure https://")
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "L'URL doit commencer par http(s)://",
    }),
});

/** Ajoute un site à surveiller (hors projet). */
export async function addSiteMonitorAction(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  await requireAdmin();
  const parsed = addSiteSchema.safeParse({
    label: formData.get("label"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  await db.siteMonitor.create({
    data: { label: parsed.data.label, url: parsed.data.url },
  });
  revalidatePath("/admin/monitoring");
  return { ok: true };
}

/** Supprime un site ajouté à la main. */
export async function deleteSiteMonitorAction(monitorId: string) {
  await requireAdmin();
  await db.siteMonitor.deleteMany({ where: { id: monitorId, projectId: null } });
  revalidatePath("/admin/monitoring");
  return { ok: true };
}

/**
 * Retire un projet du monitoring (le projet garde son URL ; le site
 * disparaît de la liste et peut être réaffiché plus tard).
 */
export async function setProjectMonitorHiddenAction(projectId: string, hidden: boolean) {
  await requireAdmin();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "Projet introuvable." };

  await db.siteMonitor.upsert({
    where: { projectId },
    create: { projectId, hidden, enabled: !hidden },
    update: hidden
      ? { hidden: true, enabled: false, status: "UNKNOWN", downSince: null, lastAlertAt: null }
      : { hidden: false, enabled: true },
  });
  revalidatePath("/admin/monitoring");
  return { ok: true };
}

/** Active / désactive le monitoring d'un site (projet ou manuel). */
export async function toggleMonitorAction(
  target: { projectId?: string; monitorId?: string },
  enabled: boolean
) {
  await requireAdmin();
  const disabledReset = enabled
    ? {}
    : { status: "UNKNOWN" as const, downSince: null };

  if (target.monitorId) {
    await db.siteMonitor.update({
      where: { id: target.monitorId },
      data: { enabled, ...disabledReset },
    });
  } else if (target.projectId) {
    const project = await db.project.findUnique({
      where: { id: target.projectId },
      select: { id: true },
    });
    if (!project) return { error: "Projet introuvable." };
    await db.siteMonitor.upsert({
      where: { projectId: target.projectId },
      create: { projectId: target.projectId, enabled },
      update: { enabled, ...disabledReset },
    });
  } else {
    return { error: "Cible invalide." };
  }
  revalidatePath("/admin/monitoring");
  return { ok: true };
}
