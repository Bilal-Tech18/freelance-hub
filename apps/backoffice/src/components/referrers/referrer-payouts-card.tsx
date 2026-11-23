"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  addReferrerPayoutAction,
  deleteReferrerPayoutAction,
} from "@/lib/actions/referrers";
import { formatEUR } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HandCoins, Trash2 } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export type ReferrerPayoutItem = {
  id: string;
  amount: number;
  method: string | null;
  note: string | null;
  paidAt: string; // ISO
};

function DeletePayoutButton({ payoutId }: { payoutId: string }) {
  const [, action] = useActionState(deleteReferrerPayoutAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="payoutId" value={payoutId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        aria-label="Supprimer le règlement"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}

export function ReferrerPayoutsCard({
  referrerId,
  payouts,
  remaining,
}: {
  referrerId: string;
  payouts: ReferrerPayoutItem[];
  remaining: number;
}) {
  const [state, formAction, pending] = useActionState(
    addReferrerPayoutAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      toast.success("Règlement enregistré");
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="size-4" />
          Règlements versés
        </CardTitle>
        <CardDescription>
          Chaque somme déjà payée à l&apos;apporteur — le reste à payer se met à
          jour automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun règlement enregistré pour l&apos;instant.
          </p>
        ) : (
          <ul className="space-y-1">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatEUR(p.amount)}</span>
                  <span className="text-muted-foreground">
                    {p.method ? `${p.method} · ` : ""}
                    {dateFmt.format(new Date(p.paidAt))}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                </div>
                <DeletePayoutButton payoutId={p.id} />
              </li>
            ))}
          </ul>
        )}

        <form
          ref={formRef}
          action={formAction}
          className="flex flex-wrap items-end gap-2 border-t pt-4"
        >
          <input type="hidden" name="referrerId" value={referrerId} />
          <div className="grid gap-1.5">
            <Label htmlFor="payout-amount">Montant (€)</Label>
            <Input
              id="payout-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder={remaining > 0 ? String(remaining) : undefined}
              className="w-32"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Moyen</Label>
            <Select name="method" defaultValue="Virement">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Virement">Virement</SelectItem>
                <SelectItem value="CB">CB</SelectItem>
                <SelectItem value="Chèque">Chèque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payout-paidAt">Date</Label>
            <Input
              id="payout-paidAt"
              name="paidAt"
              type="date"
              className="w-40"
            />
          </div>
          <div className="grid min-w-40 flex-1 gap-1.5">
            <Label htmlFor="payout-note">Note</Label>
            <Input
              id="payout-note"
              name="note"
              placeholder="Commission du client…"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Ajouter"}
          </Button>
          {state?.error && (
            <p className="w-full text-sm text-destructive">{state.error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
