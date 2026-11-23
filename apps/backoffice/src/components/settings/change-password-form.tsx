"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound } from "lucide-react";

function PasswordInput({
  id,
  name,
  autoComplete,
}: {
  id: string;
  name: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const currentPassword = String(form.get("current"));
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.code === "INVALID_PASSWORD"
          ? "Mot de passe actuel incorrect."
          : "Impossible de modifier le mot de passe. Réessayez."
      );
      return;
    }
    formEl.reset();
    toast.success("Mot de passe modifié ✅");
  }

  return (
    <Card className="max-w-lg">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Mot de passe
        </CardTitle>
        <CardDescription>
          8 caractères minimum. Les autres sessions actives seront déconnectées.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="current">Mot de passe actuel</Label>
            <PasswordInput id="current" name="current" autoComplete="current-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
          </div>
        </CardContent>
        <CardFooter className="mt-(--card-spacing) justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Enregistrement…" : "Modifier le mot de passe"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
