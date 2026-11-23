"use client";

import { useActionState } from "react";
import { createClientAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/nav/back-button";

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(createClientAction, undefined);

  return (
    <div className="max-w-lg space-y-6">
      <BackButton href="/admin/clients" label="Clients" />
      <h1 className="text-2xl font-semibold">Nouveau client</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom (société ou personne)</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Email de contact</Label>
              <Input id="contactEmail" name="contactEmail" type="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea id="notes" name="notes" rows={4} />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer le client"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
