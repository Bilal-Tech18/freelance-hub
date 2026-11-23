import type { TicketStatus } from "@prisma/client";
import { STATUS_DOT } from "@/components/tickets/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";
import { History, MoveRight } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type StatusChangeEntry = {
  id: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  createdAt: Date;
  changedBy: { name: string };
};

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Historique des statuts d'un ticket, du plus récent au plus ancien,
 * avec la création du ticket en dernière ligne.
 */
export function TicketStatusHistory({
  changes,
  createdAt,
  creatorName,
}: {
  changes: StatusChangeEntry[];
  createdAt: Date;
  creatorName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          Historique du statut
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          {changes.map((c) => (
            <li key={c.id} className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip status={c.fromStatus} />
                <MoveRight className="size-3.5 text-muted-foreground" />
                <StatusChip status={c.toStatus} />
              </div>
              <p className="text-xs text-muted-foreground">
                par {c.changedBy.name} · {dateFmt.format(c.createdAt)}
              </p>
            </li>
          ))}
          <li className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              Ticket créé
              <StatusChip status="NEW" />
            </div>
            <p className="text-xs text-muted-foreground">
              par {creatorName} · {dateFmt.format(createdAt)}
            </p>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
