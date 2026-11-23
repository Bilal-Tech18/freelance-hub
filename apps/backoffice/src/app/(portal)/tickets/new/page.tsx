import { db } from "@/lib/db";
import { requireUser, getScopedProjectWhere } from "@/lib/authz";
import { TicketForm } from "@/components/tickets/ticket-form";
import { BackButton } from "@/components/nav/back-button";

export const metadata = { title: "Nouveau ticket" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project } = await searchParams;
  const projects = await db.project.findMany({
    where: getScopedProjectWhere(user),
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <BackButton href="/tickets" label="Mes tickets" />
      <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">Aucun projet disponible.</p>
      ) : (
        <TicketForm
          projects={projects}
          defaultProjectId={
            project ?? (projects.length === 1 ? projects[0].id : undefined)
          }
        />
      )}
    </div>
  );
}
