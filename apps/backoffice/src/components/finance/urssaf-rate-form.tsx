"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateUrssafRateAction } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UrssafRateForm({
  rate,
  rateGoods,
}: {
  rate: number;
  rateGoods: number;
}) {
  const [state, formAction, pending] = useActionState(updateUrssafRateAction, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) toast.success("Taux URSSAF enregistrés");
      if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="urssafRate">URSSAF BNC (%)</Label>
        <Input
          id="urssafRate"
          name="urssafRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={rate}
          className="w-28"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="urssafRateGoods">URSSAF ventes (%)</Label>
        <Input
          id="urssafRateGoods"
          name="urssafRateGoods"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={rateGoods}
          className="w-28"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "…" : "Enregistrer"}
      </Button>
    </form>
  );
}
