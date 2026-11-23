"use client";

import { useActionState, useState } from "react";
import { deleteProjectAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteProjectAction, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4 mr-1" /> Supprimer
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <span className="text-sm text-muted-foreground">
        Supprimer {projectName} (tickets et jalons inclus) ?
      </span>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Suppression…" : "Confirmer"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Annuler
      </Button>
      {state?.error && (
        <span className="text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}
