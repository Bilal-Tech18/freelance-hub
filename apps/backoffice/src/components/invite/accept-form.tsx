"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitationAction } from "@/lib/actions/invitations";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    undefined
  );

  useEffect(() => {
    if (!state?.ok) return;
    // Compte créé côté serveur → connexion avec les identifiants saisis.
    const password = (
      document.getElementById("password") as HTMLInputElement | null
    )?.value;
    if (!password) {
      router.push("/login");
      return;
    }
    authClient.signIn
      .email({ email, password })
      .then(() => {
        router.push("/");
        router.refresh();
      })
      .catch(() => router.push("/login"));
  }, [state?.ok, email, router]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label>Email</Label>
        <Input value={email} disabled />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Votre nom</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending || state?.ok}>
        {pending || state?.ok ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
