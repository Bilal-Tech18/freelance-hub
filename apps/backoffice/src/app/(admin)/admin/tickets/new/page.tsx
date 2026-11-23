import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { TicketForm } from "@/components/tickets/ticket-form";
import { BackButton } from "@/components/nav/back-button";

export const metadata = { title: "Nouveau ticket" };

export default async function AdminNewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  await requireAdmin();
  const { project } = await searchParams;

  const [projects, clients] = await Promise.all([
    db.project.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <BackButton href="/admin/tickets" label="Tickets" />
      <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">Aucun projet disponible.</p>
      ) : (
        <TicketForm
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            clientId: p.clientId,
            clientName: p.client.name,
          }))}
          clients={clients}
          defaultProjectId={project}
        />
      )}
    </div>
  );
}
