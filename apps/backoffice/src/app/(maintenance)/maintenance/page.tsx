import Link from "next/link";
import type { Prisma, TicketStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMaintainer } from "@/lib/authz";
import { OVERDUE_EXEMPT_STATUSES } from "@/lib/sla";
import { STATUS_LABELS } from "@/lib/ticket-labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  CheckCircle2,
  FolderKanban,
  PartyPopper,
  Rocket,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

const OPEN_STATUSES: TicketStatus[] = ["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT"];

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "success";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" /> {label}
        </CardDescription>
        <CardTitle
          className={
            tone === "danger"
              ? "text-2xl text-destructive"
              : tone === "success"
                ? "text-2xl text-primary"
                : "text-2xl"
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      )}
    </Card>
  );
}

export default async function MaintenanceDashboardPage() {
  const user = await requireMaintainer();
  const scope: Prisma.TicketWhereInput = {
    project: { assignments: { some: { userId: user.id } } },
  };

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [total, open, overdue, resolvedThisWeek, byStatus, projects] =
    await Promise.all([
      db.ticket.count({ where: scope }),
      db.ticket.count({ where: { ...scope, status: { in: OPEN_STATUSES } } }),
      db.ticket.count({
        where: {
          ...scope,
          dueDate: { lt: new Date() },
          status: { notIn: OVERDUE_EXEMPT_STATUSES },
        },
      }),
      db.ticket.count({
        where: { ...scope, resolvedAt: { gte: weekAgo } },
      }),
      db.ticket.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
      }),
      db.project.findMany({
        where: { assignments: { some: { userId: user.id } } },
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
          _count: {
            select: { tickets: { where: { status: { in: OPEN_STATUSES } } } },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const done = total - open;
  const donePct = total === 0 ? 100 : Math.round((done / total) * 100);
  const statusCount = (s: TicketStatus) =>
    byStatus.find((r) => r.status === s)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salut {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Ton tableau de bord maintenance — {projects.length} projet
            {projects.length > 1 ? "s" : ""} assigné{projects.length > 1 ? "s" : ""}.
          </p>
        </div>
        <Button asChild>
          <Link href="/maintenance/tickets">Voir les tickets</Link>
        </Button>
      </div>

      {/* Bandeau motivation */}
      <Card className="border-primary/30 bg-accent/60">
        <CardContent className="flex items-center gap-4 py-5">
          {open === 0 ? (
            <PartyPopper className="size-8 text-primary shrink-0" />
          ) : (
            <Rocket className="size-8 text-primary shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">
              {open === 0
                ? "Tout est terminé, bravo ! 🎉"
                : `Encore ${open} ticket${open > 1 ? "s" : ""} et tu as terminé 💪`}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${donePct}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums">{donePct}% done</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Ticket}
          label="Tickets ouverts"
          value={String(open)}
          hint={`${total} au total sur ton périmètre`}
        />
        <Kpi
          icon={AlarmClock}
          label="En retard"
          value={String(overdue)}
          hint="Deadline SLA dépassée"
          tone={overdue > 0 ? "danger" : "success"}
        />
        <Kpi
          icon={CheckCircle2}
          label="Résolus (7 jours)"
          value={String(resolvedThisWeek)}
          hint="Bon rythme, continue !"
          tone="success"
        />
        <Kpi
          icon={FolderKanban}
          label="Projets assignés"
          value={String(projects.length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Par statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => {
              const n = statusCount(s);
              const pct = total === 0 ? 0 : Math.round((n / total) * 100);
              return (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-muted-foreground">
                    {STATUS_LABELS[s]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--chart-2)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{n}</span>
                </div>
              );
            })}
            {total === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun ticket sur ton périmètre pour l&apos;instant.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Projets assignés */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tes projets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun projet assigné — vois ça avec l&apos;administrateur.
              </p>
            )}
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/maintenance/tickets?project=${p.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="min-w-0 truncate">
                  {p.name}{" "}
                  <span className="text-muted-foreground">· {p.client.name}</span>
                </span>
                <span className="ml-3 shrink-0 tabular-nums text-muted-foreground">
                  {p._count.tickets} ouvert{p._count.tickets > 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
