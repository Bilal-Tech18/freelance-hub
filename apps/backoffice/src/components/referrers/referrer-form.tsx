"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  createReferrerAction,
  updateReferrerAction,
} from "@/lib/actions/referrers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Referrer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  iban: string | null;
  notes: string | null;
  defaultCommissionRate: number;
};

export function ReferrerForm({ referrer }: { referrer?: Referrer }) {
  const editing = Boolean(referrer);
  const action = editing ? updateReferrerAction : createReferrerAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && editing && !state?.error) {
      toast.success("Apporteur enregistré");
    }
    wasPending.current = pending;
  }, [pending, state, editing]);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          {referrer && <input type="hidden" name="id" value={referrer.id} />}
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" required defaultValue={referrer?.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={referrer?.email ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={referrer?.phone ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="defaultCommissionRate">Commission par défaut (%)</Label>
            <Input
              id="defaultCommissionRate"
              name="defaultCommissionRate"
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={referrer?.defaultCommissionRate ?? 10}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="iban">IBAN (pour te verser sa commission)</Label>
            <Input id="iban" name="iban" defaultValue={referrer?.iban ?? ""} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={referrer?.notes ?? ""} />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Créer l'apporteur"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
