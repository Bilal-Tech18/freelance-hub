import Link from "next/link";
import type { DocumentType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/services/settings";
import { formatEUR } from "@/lib/finance";
import {
  DOC_STATUS_CLASS,
  DOC_STATUS_LABELS,
  isDocOverdue,
  OVERDUE_CLASS,
  OVERDUE_LABEL,
  type DocumentStatus,
} from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";

export const metadata = { title: "Facturation" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const type: DocumentType = sp.type === "QUOTE" ? "QUOTE" : "INVOICE";

  const [documents, settings] = await Promise.all([
    db.document.findMany({
      where: { type },
      orderBy: [{ createdAt: "desc" }],
      include: { client: { select: { name: true } } },
    }),
    getSettings(),
  ]);

  const sellerConfigured = Boolean(settings.sellerName);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Facturation</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/settings/billing">Réglages émetteur</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/documents/new?type=${type}`}>
              {type === "INVOICE" ? "Nouvelle facture" : "Nouveau devis"}
            </Link>
          </Button>
        </div>
      </div>

      {!sellerConfigured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          Renseigne d&apos;abord tes informations d&apos;émetteur dans{" "}
          <Link href="/admin/settings/billing" className="underline font-medium">
            Réglages
          </Link>{" "}
          pour des documents complets.
        </div>
      )}

      <div className="flex gap-1">
        <Button
          asChild
          variant={type === "INVOICE" ? "secondary" : "ghost"}
          size="sm"
        >
          <Link href="/admin/documents?type=INVOICE">Factures</Link>
        </Button>
        <Button
          asChild
          variant={type === "QUOTE" ? "secondary" : "ghost"}
          size="sm"
        >
          <Link href="/admin/documents?type=QUOTE">Devis</Link>
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun {type === "INVOICE" ? "facture" : "devis"} pour l&apos;instant.
        </p>
      ) : (
        <DataTable
          storageKey="admin-documents"
          searchPlaceholder="Rechercher un numéro, un client…"
          initialSort={{ key: "date", dir: "desc" }}
          filters={[
            {
              key: "status",
              label: "Statut",
              options: Object.entries(DOC_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            },
            {
              key: "client",
              label: "Client",
              options: [...new Set(documents.map((d) => d.client.name))]
                .sort((a, b) => a.localeCompare(b, "fr"))
                .map((name) => ({ value: name, label: name })),
            },
          ]}
          columns={[
            { key: "number", label: "Numéro" },
            { key: "client", label: "Client" },
            { key: "date", label: "Date" },
            { key: "status", label: "Statut" },
            { key: "total", label: "Total TTC", align: "right" },
          ]}
          rows={documents.map((d): DataTableRow => {
            const date = d.issueDate ?? d.createdAt;
            return {
              id: d.id,
              href: `/admin/documents/${d.id}`,
              searchText: `${d.number ?? "brouillon"} ${d.client.name}`,
              filterValues: { status: d.status, client: d.client.name },
              sortValues: {
                number: d.number ?? "",
                client: d.client.name,
                date: date.getTime(),
                status: d.status,
                total: Number(d.total),
              },
              cells: {
                number: (
                  <span className="font-medium">{d.number ?? "Brouillon"}</span>
                ),
                client: d.client.name,
                date: (
                  <span className="text-muted-foreground">
                    {dateFmt.format(date)}
                  </span>
                ),
                status: (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_STATUS_CLASS[d.status as DocumentStatus]}`}
                    >
                      {DOC_STATUS_LABELS[d.status as DocumentStatus]}
                    </span>
                    {isDocOverdue(d) && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${OVERDUE_CLASS}`}
                      >
                        {OVERDUE_LABEL}
                      </span>
                    )}
                  </span>
                ),
                total: (
                  <span className="font-medium">{formatEUR(Number(d.total))}</span>
                ),
              },
            };
          })}
        />
      )}
    </div>
  );
}
