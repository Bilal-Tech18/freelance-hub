import { db } from "@/lib/db";
import { requireMaintainer } from "@/lib/authz";
import { TicketForm } from "@/components/tickets/ticket-form";
import { BackButton } from "@/components/nav/back-button";

export const metadata = { title: "Nouveau ticket" };

export default async function MaintenanceNewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireMaintainer();
  const { project } = await searchParams;

  const projects = await db.project.findMany({
    where: { assignments: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const clients = [
    ...new Map(projects.map((p) => [p.clientId, { id: p.clientId, name: p.client.name }])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div className="space-y-6">
      <BackButton href="/maintenance/tickets" label="Tickets" />
      <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">Aucun projet assigné.</p>
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
