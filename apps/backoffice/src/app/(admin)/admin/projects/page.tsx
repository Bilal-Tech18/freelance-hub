import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { computeProgress } from "@/components/milestones/timeline";
import { computeProjectFinancials, formatEUR } from "@/lib/finance";
import { toPaymentInputs } from "@/lib/services/finance";
import { ProjectStatusSelect } from "@/components/projects/project-status-select";
import { PROJECT_STATUS_LABELS } from "@/components/tickets/badges";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";
import type { ProjectStatus } from "@prisma/client";

export const metadata = { title: "Projets" };

const OPEN_STATUSES = ["NEW", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

// Ordre logique du cycle de vie pour le tri par statut
const STATUS_RANK: Record<ProjectStatus, number> = {
  ONBOARDING: 0,
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
  ARCHIVED: 4,
};

export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await db.project.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      milestones: true,
      payments: { select: { amount: true, vatRate: true } },
      _count: { select: { tickets: true } },
      tickets: {
        where: { status: { in: [...OPEN_STATUSES] } },
        select: { id: true },
      },
    },
  });

  const rows: DataTableRow[] = projects.map((p) => {
    const progress = p.progressOverride ?? computeProgress(p.milestones);
    const openCount = p.tickets.length;
    // Restant à payer HT : même calcul que la fiche projet (TTC dû − encaissé,
    // reconverti en HT au taux du projet). null si projet non chiffré.
    let remainingHt: number | null = null;
    if (p.amountHt != null) {
      const vatRate = Number(p.vatRate);
      const f = computeProjectFinancials(
        Number(p.amountHt),
        vatRate,
        toPaymentInputs(p.payments)
      );
      remainingHt = Math.round((f.outstanding / (1 + vatRate / 100)) * 100) / 100;
    }
    return {
      id: p.id,
      href: `/admin/projects/${p.id}`,
      searchText: `${p.name} ${p.client.name}`,
      filterValues: { status: p.status, client: p.client.id },
      sortValues: {
        name: p.name,
        client: p.client.name,
        status: STATUS_RANK[p.status],
        progress,
        // -Infinity et non -1 : un projet sur-encaissé a un reste négatif et
        // ne doit pas se mélanger aux non chiffrés, qui restent les derniers.
        remaining: remainingHt ?? Number.NEGATIVE_INFINITY,
        open: openCount,
        total: p._count.tickets,
      },
      cells: {
        name: <span className="font-medium">{p.name}</span>,
        client: <span className="text-muted-foreground">{p.client.name}</span>,
        status: <ProjectStatusSelect projectId={p.id} status={p.status} />,
        progress: (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        ),
        remaining:
          remainingHt == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={
                remainingHt < 0
                  ? "font-medium text-red-600"
                  : remainingHt > 0
                    ? "font-medium text-amber-600"
                    : "text-muted-foreground"
              }
              title={
                remainingHt < 0
                  ? "Sur-encaissé : encaissements probablement comptés deux fois"
                  : undefined
              }
            >
              {remainingHt < 0
                ? `+${formatEUR(-remainingHt)}`
                : formatEUR(remainingHt)}
            </span>
          ),
        open: (
          <span
            className={
              openCount > 0
                ? "font-semibold text-amber-600"
                : "text-muted-foreground"
            }
          >
            {openCount}
          </span>
        ),
        total: <span className="text-muted-foreground">{p._count.tickets}</span>,
      },
    };
  });

  const clientOptions = [...new Map(projects.map((p) => [p.client.id, p.client])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projets</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun projet. Créez-en un depuis la fiche d&apos;un client.
        </p>
      ) : (
        <div className="rounded-lg border bg-background p-3">
          <DataTable
            storageKey="admin-projects"
            searchPlaceholder="Rechercher un projet, un client…"
            initialSort={{ key: "status", dir: "asc" }}
            filters={[
              {
                key: "status",
                label: "Statut",
                options: Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
              { key: "client", label: "Client", options: clientOptions },
            ]}
            columns={[
              { key: "name", label: "Projet" },
              { key: "client", label: "Client" },
              { key: "status", label: "Statut" },
              { key: "progress", label: "Avancement" },
              { key: "remaining", label: "Restant HT", align: "right" },
              { key: "open", label: "Tickets ouverts", align: "right" },
              { key: "total", label: "Total tickets", align: "right" },
            ]}
            rows={rows}
          />
        </div>
      )}
    </div>
  );
}
