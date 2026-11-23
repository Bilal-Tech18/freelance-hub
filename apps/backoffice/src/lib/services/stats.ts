import "server-only";

import { db } from "@/lib/db";
import { isOverdue } from "@/lib/sla";

/**
 * KPIs calculés en mémoire : à l'échelle d'un freelance (quelques milliers de
 * tickets max), un fetch minimal + agrégation JS est plus simple et suffisant.
 */
export type Stats = {
  openCount: number;
  overdueCount: number;
  resolvedLast30d: number;
  activeProjects: number;
  avgResolutionDays: number | null;
  slaComplianceRate: number | null; // % des tickets résolus dans les temps
  byStatus: { status: string; count: number }[];
  byProject: { projectName: string; clientName: string; open: number; total: number }[];
  weekly: { week: string; created: number; resolved: number }[];
};

const OPEN_STATUSES = ["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT"];
const WEEKS = 8;

function weekKey(date: Date): string {
  // Lundi de la semaine, format "dd/MM"
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getStats(): Promise<Stats> {
  const since = new Date();
  since.setDate(since.getDate() - 365);

  const [tickets, activeProjects] = await Promise.all([
    db.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        createdAt: true,
        resolvedAt: true,
        dueDate: true,
        project: {
          select: { name: true, client: { select: { name: true } } },
        },
      },
    }),
    db.project.count({ where: { status: { in: ["ONBOARDING", "ACTIVE"] } } }),
  ]);

  const now = Date.now();
  const d30 = now - 30 * 24 * 3600 * 1000;

  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const resolved = tickets.filter((t) => t.resolvedAt);
  const resolvedLast30d = resolved.filter(
    (t) => t.resolvedAt!.getTime() >= d30
  ).length;

  const resolutionTimes = resolved.map(
    (t) => t.resolvedAt!.getTime() - t.createdAt.getTime()
  );
  const avgResolutionDays =
    resolutionTimes.length > 0
      ? Math.round(
          (resolutionTimes.reduce((a, b) => a + b, 0) /
            resolutionTimes.length /
            (24 * 3600 * 1000)) *
            10
        ) / 10
      : null;

  const withSla = resolved.filter((t) => t.dueDate);
  const slaComplianceRate =
    withSla.length > 0
      ? Math.round(
          (withSla.filter((t) => t.resolvedAt! <= t.dueDate!).length /
            withSla.length) *
            100
        )
      : null;

  const byStatusMap = new Map<string, number>();
  for (const t of tickets) {
    byStatusMap.set(t.status, (byStatusMap.get(t.status) ?? 0) + 1);
  }

  const byProjectMap = new Map<
    string,
    { projectName: string; clientName: string; open: number; total: number }
  >();
  for (const t of tickets) {
    const key = `${t.project.client.name}·${t.project.name}`;
    const entry = byProjectMap.get(key) ?? {
      projectName: t.project.name,
      clientName: t.project.client.name,
      open: 0,
      total: 0,
    };
    entry.total++;
    if (OPEN_STATUSES.includes(t.status)) entry.open++;
    byProjectMap.set(key, entry);
  }

  const weekly: Stats["weekly"] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const ref = new Date(now - i * 7 * 24 * 3600 * 1000);
    weekly.push({ week: weekKey(ref), created: 0, resolved: 0 });
  }
  const weeklyIndex = new Map(weekly.map((w, i) => [w.week, i]));
  const oldestWeek = now - WEEKS * 7 * 24 * 3600 * 1000;
  for (const t of tickets) {
    if (t.createdAt.getTime() >= oldestWeek) {
      const idx = weeklyIndex.get(weekKey(t.createdAt));
      if (idx !== undefined) weekly[idx].created++;
    }
    if (t.resolvedAt && t.resolvedAt.getTime() >= oldestWeek) {
      const idx = weeklyIndex.get(weekKey(t.resolvedAt));
      if (idx !== undefined) weekly[idx].resolved++;
    }
  }

  return {
    openCount: open.length,
    overdueCount: tickets.filter((t) =>
      isOverdue({ status: t.status as never, dueDate: t.dueDate })
    ).length,
    resolvedLast30d,
    activeProjects,
    avgResolutionDays,
    slaComplianceRate,
    byStatus: Array.from(byStatusMap, ([status, count]) => ({ status, count })),
    byProject: Array.from(byProjectMap.values()).sort((a, b) => b.open - a.open),
    weekly,
  };
}
