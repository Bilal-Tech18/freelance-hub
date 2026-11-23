"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { inviteUserAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(inviteUserAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      toast.success("Invitation envoyée");
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="flex gap-2">
        <Input
          name="email"
          type="email"
          placeholder="email@client.com"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Inviter"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
