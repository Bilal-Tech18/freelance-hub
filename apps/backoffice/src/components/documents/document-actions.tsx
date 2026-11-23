"use client";

import { useActionState, useState } from "react";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import {
  acceptQuoteAction,
  cancelDocumentAction,
  convertQuoteAction,
  deleteDocumentAction,
  issueDocumentAction,
  markPaidAction,
  refuseQuoteAction,
  restoreDocumentAction,
  unmarkPaidAction,
} from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/finance";

function ActionButton({
  id,
  action,
  label,
  variant = "default",
  confirm,
}: {
  id: string;
  action: (
    prev: { error?: string } | undefined,
    fd: FormData
  ) => Promise<{ error?: string } | undefined>;
  label: string;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {state?.error && (
        <span className="ml-2 text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}

export type PaymentCandidate = {
  id: string;
  amount: number;
  paidAt: string; // ISO
  label: string;
};

const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

/**
 * Marquer payée avec choix de la date de paiement (défaut : aujourd'hui), ou
 * rattachement à un encaissement déjà saisi (facture acquittée émise après
 * coup) pour ne pas compter deux fois le même règlement.
 */
function MarkPaidForm({
  id,
  total,
  candidates,
}: {
  id: string;
  total: number;
  candidates: PaymentCandidate[];
}) {
  const [state, formAction, pending] = useActionState(markPaidAction, undefined);
  const today = new Date().toISOString().slice(0, 10);
  const [paymentId, setPaymentId] = useState(
    () => candidates.find((c) => Math.abs(c.amount - total) < 0.005)?.id ?? ""
  );
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      {candidates.length > 0 && (
        <select
          name="paymentId"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          aria-label="Encaissement"
        >
          <option value="">Nouvel encaissement</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              Déjà encaissé : {formatEUR(c.amount)} le {shortDate.format(new Date(c.paidAt))}
              {c.label ? ` (${c.label})` : ""}
            </option>
          ))}
        </select>
      )}
      {!paymentId && (
        <Input
          name="paidAt"
          type="date"
          defaultValue={today}
          max={today}
          className="h-8 w-36"
          aria-label="Date de paiement"
        />
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Marquer payée"}
      </Button>
      {state?.error && (
        <span className="ml-1 text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}

export function DocumentActions({
  id,
  type,
  status,
  converted,
  total = 0,
  paymentCandidates = [],
}: {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  converted: boolean;
  total?: number;
  paymentCandidates?: PaymentCandidate[];
}) {
  const isInvoice = type === "INVOICE";
  const issueLabel = isInvoice ? "Émettre la facture" : "Émettre le devis";
  const docLabel = isInvoice ? "cette facture" : "ce devis";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/documents/${id}/pdf`} target="_blank" rel="noreferrer">
          Télécharger le PDF
        </a>
      </Button>

      {status === "DRAFT" && (
        <>
          <ActionButton id={id} action={issueDocumentAction} label={issueLabel} />
          <ActionButton
            id={id}
            action={deleteDocumentAction}
            label="Supprimer"
            variant="ghost"
            confirm={`Supprimer définitivement ${docLabel} ?`}
          />
        </>
      )}

      {isInvoice && status === "ISSUED" && (
        <MarkPaidForm id={id} total={total} candidates={paymentCandidates} />
      )}

      {isInvoice && status === "PAID" && (
        <ActionButton
          id={id}
          action={unmarkPaidAction}
          label="Repasser en émise"
          variant="outline"
          confirm="Annuler le paiement ? L'encaissement créé par la facture sera supprimé (un encaissement saisi avant elle est conservé)."
        />
      )}

      {!isInvoice && status === "ISSUED" && (
        <>
          <ActionButton id={id} action={acceptQuoteAction} label="Marquer accepté" />
          <ActionButton id={id} action={refuseQuoteAction} label="Marquer refusé" variant="outline" />
        </>
      )}

      {!isInvoice && (status === "ISSUED" || status === "ACCEPTED") && !converted && (
        <ActionButton id={id} action={convertQuoteAction} label="Convertir en facture" variant="secondary" />
      )}

      {status !== "DRAFT" && status !== "CANCELLED" && status !== "PAID" && (
        <ActionButton
          id={id}
          action={cancelDocumentAction}
          label="Annuler"
          variant="ghost"
          confirm={`Annuler ${docLabel} ? Vous pourrez le rétablir ou le supprimer ensuite.`}
        />
      )}

      {status === "CANCELLED" && (
        <>
          <ActionButton id={id} action={restoreDocumentAction} label="Rétablir" variant="outline" />
          <ActionButton
            id={id}
            action={deleteDocumentAction}
            label="Supprimer"
            variant="destructive"
            confirm={`Supprimer définitivement ${docLabel} ? Cette action est irréversible.`}
          />
        </>
      )}
    </div>
  );
}
