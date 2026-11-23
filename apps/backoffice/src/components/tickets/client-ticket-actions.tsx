"use client";

import { useActionState } from "react";
import type { TicketStatus } from "@prisma/client";
import { clientMoveTicketAction } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw } from "lucide-react";

function StatusForm({
  ticketId,
  to,
  label,
  pendingLabel,
  variant,
  icon,
  fullWidth,
}: {
  ticketId: string;
  to: TicketStatus;
  label: string;
  pendingLabel: string;
  variant: "default" | "outline";
  icon: React.ReactNode;
  /** Bouton pleine largeur sur mobile (bannière de la fiche ticket). */
  fullWidth?: boolean;
}) {
  const [state, formAction, pending] = useActionState(clientMoveTicketAction, undefined);
  return (
    <form action={formAction} className={fullWidth ? "w-full sm:w-auto" : "inline"}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="status" value={to} />
      <Button
        type="submit"
        variant={variant}
        size="sm"
        disabled={pending}
        className={fullWidth ? "w-full sm:w-auto" : undefined}
      >
        {icon} {pending ? pendingLabel : label}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive mt-1">{state.error}</p>
      )}
    </form>
  );
}

/**
 * Actions du client sur le cycle de vie : valider un ticket résolu,
 * ou le rouvrir s'il n'est pas corrigé (y compris après validation).
 * Sur un ticket résolu, une bannière invite explicitement à tester puis valider.
 */
export function ClientTicketActions({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  if (status === "RESOLVED") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <CheckCircle2 className="size-5 mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Le correctif est prêt — à vous de valider</p>
              <p className="text-sm text-muted-foreground">
                Testez la correction : si tout est bon, validez le ticket.
                Sinon, rouvrez-le et précisez en commentaire ce qui ne va pas.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <StatusForm
              ticketId={ticketId}
              to="CLOSED"
              label="Valider le ticket"
              pendingLabel="Validation…"
              variant="default"
              icon={<CheckCircle2 className="size-4 mr-1" />}
              fullWidth
            />
            <StatusForm
              ticketId={ticketId}
              to="IN_PROGRESS"
              label="Rouvrir"
              pendingLabel="Réouverture…"
              variant="outline"
              icon={<RotateCcw className="size-4 mr-1" />}
              fullWidth
            />
          </div>
        </div>
      </div>
    );
  }
  if (status === "CLOSED") {
    return (
      <div>
        <StatusForm
          ticketId={ticketId}
          to="IN_PROGRESS"
          label="Rouvrir le ticket"
          pendingLabel="Réouverture…"
          variant="outline"
          icon={<RotateCcw className="size-4 mr-1" />}
        />
      </div>
    );
  }
  return null;
}

/**
 * Bouton « Valider » compact pour les lignes de la liste des tickets :
 * permet de clôturer un ticket résolu sans ouvrir sa fiche.
 * stopPropagation évite que le clic déclenche la navigation de la ligne.
 */
export function QuickValidateButton({ ticketId }: { ticketId: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <StatusForm
        ticketId={ticketId}
        to="CLOSED"
        label="Valider"
        pendingLabel="Validation…"
        variant="default"
        icon={<CheckCircle2 className="size-4 mr-1" />}
      />
    </span>
  );
}
