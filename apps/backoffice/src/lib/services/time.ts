import "server-only";

import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_SHOWN = 14;

// Jour local Paris (le serveur tourne en UTC sur Render).
const dayKeyFmt = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
}); // "2026-08-03"
const dayLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

export type TimeOverview = Awaited<ReturnType<typeof getTimeOverview>>;

/** Vue d'ensemble du suivi du temps — ADMIN uniquement. */
export async function getTimeOverview(now = new Date()) {
  const since = new Date(now.getTime() - DAYS_SHOWN * DAY_MS);
  // Toutes les entrées servent aux totaux par projet ; volume faible (solo).
  const entries = await db.timeEntry.findMany({
    include: {
      project: {
        select: { id: true, name: true, client: { select: { name: true } } },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const durationOf = (e: { startedAt: Date; endedAt: Date | null }) =>
    (e.endedAt ?? now).getTime() - e.startedAt.getTime();

  const runningEntry = entries.find((e) => e.endedAt === null) ?? null;
  const running = runningEntry
    ? {
        id: runningEntry.id,
        projectId: runningEntry.project.id,
        label: `${runningEntry.project.client.name} / ${runningEntry.project.name}`,
        startedAt: runningEntry.startedAt.toISOString(),
      }
    : null;

  // Par jour (14 derniers jours), avec répartition par projet.
  const monthKey = dayKeyFmt.format(now).slice(0, 7); // "2026-08"
  const todayKey = dayKeyFmt.format(now);
  const byDay = new Map<string, { totalMs: number; perProject: Map<string, number> }>();
  const byProject = new Map<
    string,
    { name: string; clientName: string; monthMs: number; totalMs: number }
  >();

  for (const e of entries) {
    const ms = durationOf(e);
    const key = dayKeyFmt.format(e.startedAt);

    const proj = byProject.get(e.project.id) ?? {
      name: e.project.name,
      clientName: e.project.client.name,
      monthMs: 0,
      totalMs: 0,
    };
    proj.totalMs += ms;
    if (key.startsWith(monthKey)) proj.monthMs += ms;
    byProject.set(e.project.id, proj);

    if (e.startedAt < since && key !== todayKey) continue;
    const day = byDay.get(key) ?? { totalMs: 0, perProject: new Map() };
    day.totalMs += ms;
    const label = `${e.project.client.name} / ${e.project.name}`;
    day.perProject.set(label, (day.perProject.get(label) ?? 0) + ms);
    byDay.set(key, day);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, d]) => ({
      key,
      label: dayLabelFmt.format(new Date(`${key}T12:00:00`)),
      isToday: key === todayKey,
      totalMs: d.totalMs,
      perProject: [...d.perProject.entries()]
        .map(([label, ms]) => ({ label, ms }))
        .sort((a, b) => b.ms - a.ms),
    }));

  return {
    running,
    todayMs: byDay.get(todayKey)?.totalMs ?? 0,
    days,
    projects: [...byProject.entries()]
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.totalMs - a.totalMs),
    recent: entries
      .filter((e) => e.endedAt !== null)
      .slice(0, 15)
      .map((e) => ({
        id: e.id,
        label: `${e.project.client.name} / ${e.project.name}`,
        startedAt: e.startedAt,
        endedAt: e.endedAt!,
        ms: durationOf(e),
      })),
  };
}
