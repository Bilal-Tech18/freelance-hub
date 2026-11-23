import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { listReferrers } from "@/lib/services/referrers";
import { formatEUR } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";

export const metadata = { title: "Apporteurs d'affaires" };

export default async function ReferrersPage() {
  await requireAdmin();
  const referrers = await listReferrers(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Apporteurs d&apos;affaires</h1>
        <Button asChild>
          <Link href="/admin/referrers/new">Nouvel apporteur</Link>
        </Button>
      </div>

      {referrers.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun apporteur. Créez-en un, puis rattachez-le à un client depuis sa
          fiche.
        </p>
      ) : (
        <div className="rounded-lg border bg-background p-3">
          <DataTable
            storageKey="admin-referrers"
            searchPlaceholder="Rechercher un apporteur…"
            initialSort={{ key: "remaining", dir: "desc" }}
            columns={[
              { key: "name", label: "Nom" },
              { key: "clients", label: "Clients apportés", align: "right" },
              { key: "active", label: "Actifs", align: "right" },
              { key: "due", label: "Commission due", align: "right" },
              { key: "paid", label: "Réglé", align: "right" },
              { key: "remaining", label: "Reste à payer", align: "right" },
            ]}
            rows={referrers.map((r): DataTableRow => ({
              id: r.id,
              href: `/admin/referrers/${r.id}`,
              searchText: `${r.name} ${r.email ?? ""}`,
              sortValues: {
                name: r.name,
                clients: r.clientCount,
                active: r.activeCount,
                due: r.totalDue,
                paid: r.totalPaid,
                remaining: r.remaining,
              },
              cells: {
                name: (
                  <>
                    <span className="font-medium">{r.name}</span>
                    {r.email && (
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    )}
                  </>
                ),
                clients: r.clientCount,
                active: r.activeCount,
                due: formatEUR(r.totalDue),
                paid: (
                  <span className="text-emerald-600">
                    {r.totalPaid > 0 ? formatEUR(r.totalPaid) : "—"}
                  </span>
                ),
                remaining: (
                  <span
                    className={`font-medium ${
                      r.remaining > 0 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {formatEUR(r.remaining)}
                  </span>
                ),
              },
            }))}
          />
        </div>
      )}
    </div>
  );
}
