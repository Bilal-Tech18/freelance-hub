"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { assignReferralAction } from "@/lib/actions/referrers";
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

const NONE = "__none";

export function ReferralCard({
  clientId,
  referrers,
  current,
}: {
  clientId: string;
  referrers: { id: string; name: string }[];
  current: {
    referrerId: string | null;
    referralDate: string | null; // yyyy-MM-dd
    commissionRate: number | null;
    referralDurationMonths: number;
  };
}) {
  const [state, formAction, pending] = useActionState(assignReferralAction, undefined);
  const [referrerId, setReferrerId] = useState(current.referrerId ?? NONE);
  const hasReferrer = referrerId !== NONE;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) toast.success("Apporteur enregistré");
      else if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apporteur d&apos;affaires</CardTitle>
        <CardDescription>
          Commission versée sur le CA HT déclaré de ce client pendant la durée
          définie à partir de la date d&apos;apport.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={clientId} />
          {/* input caché explicite : un Select Radix contrôlé ne soumet pas
              sa valeur de façon fiable dans un formulaire */}
          <input type="hidden" name="referrerId" value={hasReferrer ? referrerId : ""} />
          <div className="grid gap-1.5">
            <Label>Apporteur</Label>
            <Select value={referrerId} onValueChange={setReferrerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Aucun</SelectItem>
                {referrers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasReferrer && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="referralDate">Date d&apos;apport</Label>
                <Input
                  id="referralDate"
                  name="referralDate"
                  type="date"
                  defaultValue={current.referralDate ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="commissionRate">Commission (%) — vide = défaut apporteur</Label>
                <Input
                  id="commissionRate"
                  name="commissionRate"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  defaultValue={current.commissionRate ?? ""}
                  placeholder="10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="referralDurationMonths">Durée (mois)</Label>
                <Input
                  id="referralDurationMonths"
                  name="referralDurationMonths"
                  type="number"
                  min="1"
                  max="60"
                  defaultValue={current.referralDurationMonths}
                />
              </div>
            </>
          )}
          {!hasReferrer && (
            <>
              <input type="hidden" name="referralDurationMonths" value="12" />
            </>
          )}
          {state?.error && (
            <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
