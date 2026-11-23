import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, getScopedProjectWhere } from "@/lib/authz";
import { computeProgress } from "@/components/milestones/timeline";
import { ProjectStatusBadge } from "@/components/tickets/badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  KeyRound,
  LifeBuoy,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";

export const metadata = { title: "Mes projets" };

const OPEN = ["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT"] as const;

export default async function ClientProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: getScopedProjectWhere(user),
    orderBy: { createdAt: "desc" },
    include: {
      milestones: true,
      credentialRequests: true,
      _count: {
        select: {
          tickets: { where: { status: { in: [...OPEN] }, internal: false } },
        },
      },
    },
  });

  const firstName = user.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      {/* Bandeau de bienvenue */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 to-teal-700 p-6 md:p-8 text-white">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-medium text-emerald-100">Espace client</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold">
            Bienvenue{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-2 text-emerald-50/90 text-sm md:text-base leading-relaxed">
            Ici vous suivez l&apos;avancement de vos projets, faites vos retours
            sous forme de tickets, et partagez en toute sécurité les accès dont
            j&apos;ai besoin. Tout est centralisé — plus besoin d&apos;emails
            dispersés.
          </p>
        </div>
        <Sparkles className="absolute -right-6 -top-6 size-40 text-white/10" />
      </section>

      {/* Raccourcis */}
      <section className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          href="/tickets/new"
          icon={<MessageSquarePlus className="size-5" />}
          title="Faire un retour"
          desc="Signalez un bug, une évolution ou une question sur votre projet."
        />
        <ActionCard
          href="/tickets"
          icon={<LifeBuoy className="size-5" />}
          title="Suivre mes tickets"
          desc="Visualisez l'état de vos demandes sur un board type Trello."
        />
        <ActionCard
          href="/vault"
          icon={<KeyRound className="size-5" />}
          title="Mes accès"
          desc="Consultez et fournissez vos identifiants, chiffrés et privés."
        />
      </section>

      {/* Projets */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Mes projets</h2>
          <p className="text-sm text-muted-foreground">
            Cliquez sur un projet pour voir sa timeline, ses jalons et ses tickets.
          </p>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun projet pour le moment. Il apparaîtra ici dès qu&apos;il sera
              créé.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => {
              const progress = p.progressOverride ?? computeProgress(p.milestones);
              const pendingAccess = p.credentialRequests.filter(
                (r) => r.status !== "PROVIDED"
              ).length;
              const onboarding = p.status === "ONBOARDING";
              return (
                <Card key={p.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                    {p.description && (
                      <CardDescription className="line-clamp-2">
                        {p.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto space-y-4">
                    {/* Avancement */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Avancement</span>
                        <span className="font-medium text-foreground">{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Infos rapides */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {p._count.tickets} ticket{p._count.tickets > 1 ? "s" : ""} ouvert
                        {p._count.tickets > 1 ? "s" : ""}
                      </span>
                      {pendingAccess > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {pendingAccess} accès à fournir
                        </span>
                      )}
                    </div>

                    {onboarding && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-sm">
                        🚀 Démarrons ! Remplissez le questionnaire de démarrage
                        pour lancer le projet.
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button asChild size="sm" className="flex-1">
                        <Link href={`/projects/${p.id}`}>
                          Voir le projet <ArrowRight className="size-4 ml-1" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tickets/new?project=${p.id}`}>Retour</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Aide */}
      <section className="rounded-xl border bg-muted/40 p-5">
        <h3 className="font-semibold text-sm mb-3">Comment ça marche ?</h3>
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <HelpItem
            n="1"
            title="Onboarding"
            desc="Vous remplissez un court questionnaire et fournissez les accès nécessaires (chiffrés)."
          />
          <HelpItem
            n="2"
            title="Suivi & retours"
            desc="Vous suivez l'avancement (jalons) et créez des tickets pour tout retour."
          />
          <HelpItem
            n="3"
            title="Validation"
            desc="Quand une demande est corrigée, vous la testez et la validez d'un glissement sur le board."
          />
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors hover:border-emerald-300 dark:hover:border-emerald-800">
        <CardContent className="pt-6 space-y-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {icon}
          </div>
          <div className="font-medium flex items-center gap-1">
            {title}
            <ArrowRight className="size-4 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function HelpItem({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
