"use client";

import { useActionState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createRecurringDraftAction, type ActionState } from "@/lib/actions/mrr";
import type { RecurringBillingItem } from "@/lib/services/finance";
import { formatEUR } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, FilePlus2, FileText, ReceiptText } from "lucide-react";

function DraftButton({ recurringId }: { recurringId: string }) {
  const [, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createRecurringDraftAction(prev, formData);
      // En cas de succès l'action redirige vers le brouillon ; on n'arrive
      // ici qu'en erreur.
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={recurringId} />
      <Button type="submit" size="sm" disabled={pending}>
        <FilePlus2 className="size-4 mr-1" />
        {pending ? "Création…" : "Créer le brouillon"}
      </Button>
    </form>
  );
}

/**
 * Facturation du mois pour les revenus récurrents : qui reste à facturer,
 * quels brouillons sont à finaliser, qui est déjà couvert. Les brouillons
 * sont créés pré-remplis — l'émission reste une décision manuelle.
 */
export function RecurringBillingCard({
  items,
  monthName,
}: {
  items: RecurringBillingItem[];
  monthName: string;
}) {
  if (items.length === 0) return null;
  const todo = items.filter((i) => i.status === "todo").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4" />À facturer — {monthName}
        </CardTitle>
        <CardDescription>
          {todo > 0
            ? `${todo} récurrent${todo > 1 ? "s" : ""} sans facture ce mois-ci. Le bouton crée un brouillon pré-rempli — rien n'est émis automatiquement.`
            : "Tous les récurrents du mois sont facturés ou en brouillon."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.recurringId}
              className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${
                item.status === "done" ? "text-muted-foreground" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="font-medium">{item.clientName}</span>{" "}
                <span className="text-muted-foreground">· {item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.mode === "DAILY"
                    ? `${item.days} j ouvrés × ${formatEUR(item.unitHt)} = ${formatEUR(item.expectedHt)} HT`
                    : `${formatEUR(item.expectedHt)} HT`}
                </span>
              </span>
              {item.status === "todo" && (
                <DraftButton recurringId={item.recurringId} />
              )}
              {item.status === "draft" && item.draftId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/documents/${item.draftId}`}>
                    <FileText className="size-4 mr-1" />
                    Finaliser le brouillon
                  </Link>
                </Button>
              )}
              {item.status === "done" && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="size-4" /> Facturé
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
