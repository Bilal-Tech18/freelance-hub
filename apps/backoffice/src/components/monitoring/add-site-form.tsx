"use client";

import { useActionState } from "react";
import { addSiteMonitorAction } from "@/lib/actions/monitoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export function AddSiteForm() {
  const [state, formAction, pending] = useActionState(addSiteMonitorAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="label"
          placeholder="Nom (ex : Portfolio)"
          required
          className="w-44"
        />
        <Input
          name="url"
          type="url"
          placeholder="https://…"
          required
          className="min-w-64 flex-1"
        />
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {pending ? "Ajout…" : "Ajouter"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
