"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateClientAction } from "@/lib/actions/clients";
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
import { Textarea } from "@/components/ui/textarea";

export function ClientInfoForm({
  clientId,
  info,
}: {
  clientId: string;
  info: { name: string; contactEmail: string | null; notes: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateClientAction, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) toast.success("Client enregistré");
      if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations</CardTitle>
        <CardDescription>Nom, contact et notes internes</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" defaultValue={info.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contactEmail">Email de contact</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={info.contactEmail ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes internes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={info.notes ?? ""} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
