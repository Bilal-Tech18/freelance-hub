"use client";

import { useTransition } from "react";
import { deleteTimeEntryAction } from "@/lib/actions/time";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteTimeEntryAction(id);
        })
      }
      aria-label="Supprimer l'entrée"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
