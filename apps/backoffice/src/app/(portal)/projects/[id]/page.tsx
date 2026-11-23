import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, getScopedProjectWhere } from "@/lib/authz";
import { MilestoneTimeline } from "@/components/milestones/timeline";
import { StatusBadge } from "@/components/tickets/badges";
import { BackButton } from "@/components/nav/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ClientProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ...getScopedProjectWhere(user) },
    include: {
      milestones: { orderBy: { order: "asc" } },
      onboarding: true,
      tickets: { where: { internal: false }, orderBy: { createdAt: "desc" }, take: 5 },
      credentialRequests: true,
    },
  });
  if (!project) notFound();

  const onboardingPending = project.onboarding?.status === "PENDING";
  const pendingAccess = project.credentialRequests.filter(
    (r) => r.status !== "PROVIDED"
  ).length;

  return (
    <div className="space-y-6">
      <BackButton href="/projects" label="Mes projets" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <Button asChild>
          <Link href={`/tickets/new?project=${project.id}`}>Faire un retour</Link>
        </Button>
      </div>

      {onboardingPending ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              Questionnaire de démarrage à remplir
            </CardTitle>
            <CardDescription>
              Vos réponses me permettent de cadrer le projet : objectifs,
              contenus, accès. Comptez ~10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href={`/projects/${project.id}/onboarding`}>
                Remplir le questionnaire
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={pendingAccess > 0 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader>
            <CardTitle className="text-base">Onboarding & accès</CardTitle>
            <CardDescription>
              {pendingAccess > 0
                ? `Il reste ${pendingAccess} accès à me fournir. Vous pouvez compléter à tout moment.`
                : "Vous pouvez revenir compléter ou mettre à jour vos informations et accès quand vous voulez."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant={pendingAccess > 0 ? "default" : "outline"}>
              <Link href={`/projects/${project.id}/onboarding`}>
                {pendingAccess > 0 ? "Compléter mes accès" : "Revoir mon onboarding"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avancement du projet</CardTitle>
          </CardHeader>
          <CardContent>
            <MilestoneTimeline
              milestones={project.milestones}
              progressOverride={project.progressOverride}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Derniers tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {project.tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun ticket sur ce projet.
              </p>
            ) : (
              <ul className="space-y-2">
                {project.tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="text-sm hover:underline truncate"
                    >
                      #{t.number} — {t.title}
                    </Link>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
