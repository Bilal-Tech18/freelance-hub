"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleMonitorAction } from "@/lib/actions/monitoring";
import { Button } from "@/components/ui/button";

export function MonitorToggle({
  projectId,
  monitorId,
  enabled,
}: {
  projectId?: string;
  monitorId?: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleMonitorAction({ projectId, monitorId }, !enabled);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      {enabled ? "Désactiver" : "Activer"}
    </Button>
  );
}
