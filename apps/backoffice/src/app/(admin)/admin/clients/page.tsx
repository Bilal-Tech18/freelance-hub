import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";

export const metadata = { title: "Clients" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { projects: true, users: true } },
    },
  });

  const rows: DataTableRow[] = clients.map((c) => ({
    id: c.id,
    href: `/admin/clients/${c.id}`,
    searchText: `${c.name} ${c.contactEmail ?? ""}`,
    sortValues: {
      name: c.name,
      contact: c.contactEmail ?? "",
      projects: c._count.projects,
      users: c._count.users,
      createdAt: c.createdAt.getTime(),
    },
    cells: {
      name: <span className="font-medium">{c.name}</span>,
      contact: (
        <span className="text-muted-foreground">{c.contactEmail ?? "—"}</span>
      ),
      projects: c._count.projects,
      users: c._count.users,
      createdAt: (
        <span className="text-muted-foreground">{dateFmt.format(c.createdAt)}</span>
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button asChild>
          <Link href="/admin/clients/new">Nouveau client</Link>
        </Button>
      </div>
      {clients.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun client. Créez le premier pour démarrer.
        </p>
      ) : (
        <DataTable
          storageKey="admin-clients"
          searchPlaceholder="Rechercher un client, un email…"
          initialSort={{ key: "createdAt", dir: "desc" }}
          columns={[
            { key: "name", label: "Nom" },
            { key: "contact", label: "Contact" },
            { key: "projects", label: "Projets", align: "right" },
            { key: "users", label: "Utilisateurs", align: "right" },
            { key: "createdAt", label: "Créé le" },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
