import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { listTickets } from "@/lib/services/tickets";
import {
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/tickets/badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";
import {
  CLIENT_STATUS_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/ticket-labels";
import { QuickValidateButton } from "@/components/tickets/client-ticket-actions";
import { CheckCircle2, Lightbulb } from "lucide-react";

export const metadata = { title: "Mes tickets" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const GUIDE_TIPS = [
  {
    title: "Un problème = un ticket",
    body: "Évitez de regrouper plusieurs sujets : chaque ticket suit son propre statut et sa propre correction.",
  },
  {
    title: "Un titre précis",
    body: "« Le bouton Payer ne répond pas sur mobile » plutôt que « Ça ne marche pas ».",
  },
  {
    title: "Comment reproduire",
    body: "Sur quelle page ? Après quelle action ? À quelle heure ? Plus c'est précis, plus la correction est rapide.",
  },
  {
    title: "Une capture d'écran",
    body: "Une image du problème (ou du message d'erreur) évite souvent plusieurs échanges.",
  },
  {
    title: "La bonne priorité",
    body: "« Urgente » = site inutilisable. Une priorité juste permet de traiter le plus important d'abord.",
  },
];

export default async function ClientTicketsPage() {
  const user = await requireUser();
  const { tickets } = await listTickets(user, { limit: 200 });
  const toValidate = tickets.filter((t) => t.status === "RESOLVED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Mes tickets</h1>
          <p className="text-sm text-muted-foreground">
            Suivez vos retours et validez les corrections. Un ticket « Résolu »
            vous attend ? Testez, puis validez-le en un clic — ou rouvrez-le
            depuis sa fiche si le problème persiste.
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/new">Nouveau ticket</Link>
        </Button>
      </div>

      {toValidate.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <p className="font-medium">
              {toValidate.length === 1
                ? "1 correctif à valider"
                : `${toValidate.length} correctifs à valider`}
            </p>
          </div>
          <ul className="mt-3 space-y-2">
            {toValidate.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2"
              >
                <Link href={`/tickets/${t.id}`} className="min-w-0 text-sm hover:underline">
                  <span className="text-muted-foreground">#{t.number}</span>{" "}
                  <span className="font-medium">{t.title}</span>
                </Link>
                <QuickValidateButton ticketId={t.id} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Testez la correction avant de valider. Un doute ? Ouvrez le ticket
            pour voir le détail ou le rouvrir.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <DataTable
          storageKey="portal-tickets"
          searchPlaceholder="Rechercher un ticket…"
          initialSort={{ key: "createdAt", dir: "desc" }}
          emptyMessage="Aucun ticket pour l'instant."
          filters={[
            {
              key: "status",
              label: "Statut",
              options: Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            },
          ]}
          columns={[
            { key: "number", label: "#" },
            { key: "title", label: "Titre" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priorité" },
            { key: "status", label: "Statut" },
            { key: "createdAt", label: "Créé le" },
          ]}
          rows={tickets.map((t): DataTableRow => ({
            id: t.id,
            href: `/tickets/${t.id}`,
            searchText: `#${t.number} ${t.title} ${t.project.name} ${TYPE_LABELS[t.type]} ${PRIORITY_LABELS[t.priority]}`,
            filterValues: { status: t.status },
            sortValues: {
              number: t.number,
              title: t.title,
              type: TYPE_LABELS[t.type],
              priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(t.priority),
              status: STATUS_LABELS[t.status],
              createdAt: t.createdAt.getTime(),
            },
            cells: {
              number: <span className="text-muted-foreground">#{t.number}</span>,
              title: (
                <>
                  <span className="font-medium">{t.title}</span>
                  <p className="text-xs text-muted-foreground">{t.project.name}</p>
                </>
              ),
              type: <TypeBadge type={t.type} />,
              priority: <PriorityBadge priority={t.priority} />,
              status: <StatusBadge status={t.status} />,
              createdAt: (
                <span className="text-muted-foreground">
                  {dateFmt.format(t.createdAt)}
                </span>
              ),
            },
          }))}
        />

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-amber-500" />
              Bien rédiger un ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {GUIDE_TIPS.map((tip) => (
                <div key={tip.title} className="flex gap-2 text-sm">
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-medium">{tip.title}</p>
                    <p className="text-muted-foreground">{tip.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Un ticket bien décrit, c&apos;est une correction plus rapide et
              moins d&apos;allers-retours.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
