"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setProjectMonitorHiddenAction } from "@/lib/actions/monitoring";
import { Button } from "@/components/ui/button";

export function RestoreSiteButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-1.5 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setProjectMonitorHiddenAction(projectId, false);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      Réafficher
    </Button>
  );
}
