import type { TicketPriority, TicketType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, TypeBadge } from "@/components/tickets/badges";
import { Pencil } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type RevisionEntry = {
  id: string;
  previousTitle: string;
  previousDescription: string;
  previousType: TicketType;
  previousPriority: TicketPriority;
  createdAt: Date;
  editedBy: { name: string };
};

/**
 * Historique des modifications d'un ticket (admin uniquement) :
 * chaque entrée montre l'état du ticket AVANT la modification,
 * de la plus récente à la plus ancienne.
 */
export function TicketRevisionHistory({
  revisions,
}: {
  revisions: RevisionEntry[];
}) {
  if (revisions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pencil className="size-4" />
          Historique des modifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4 text-sm">
          {revisions.map((r) => (
            <li key={r.id} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Modifié par {r.editedBy.name} · {dateFmt.format(r.createdAt)}
              </p>
              <div className="rounded-md border bg-muted/40 p-2.5 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Avant modification :
                </p>
                <p className="font-medium">{r.previousTitle}</p>
                <div className="flex flex-wrap gap-1.5">
                  <TypeBadge type={r.previousType} />
                  <PriorityBadge priority={r.previousPriority} />
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
                    Description d&apos;origine
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {r.previousDescription}
                  </p>
                </details>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
