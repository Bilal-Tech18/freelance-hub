"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { runSiteChecksAction } from "@/lib/actions/monitoring";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function CheckNowButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runSiteChecksAction();
          toast.success(
            res.down > 0
              ? `${res.checked} site(s) vérifié(s) — ${res.down} down`
              : `${res.checked} site(s) vérifié(s), tout est en ligne`
          );
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Vérification…" : "Vérifier maintenant"}
    </Button>
  );
}
