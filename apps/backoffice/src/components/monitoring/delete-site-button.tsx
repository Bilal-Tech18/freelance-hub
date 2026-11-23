"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteSiteMonitorAction,
  setProjectMonitorHiddenAction,
} from "@/lib/actions/monitoring";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

/**
 * Retire un site de la liste : suppression pour un site ajouté à la main,
 * masquage (réaffichable) pour un site lié à un projet.
 */
export function DeleteSiteButton({
  monitorId,
  projectId,
}: {
  monitorId?: string;
  projectId?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = projectId
            ? await setProjectMonitorHiddenAction(projectId, true)
            : monitorId
              ? await deleteSiteMonitorAction(monitorId)
              : undefined;
          if (res && "error" in res && res.error) toast.error(res.error);
        })
      }
      aria-label="Retirer le site du monitoring"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
