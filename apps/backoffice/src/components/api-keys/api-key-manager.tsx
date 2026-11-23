"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/lib/actions/api-keys";
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
import { Copy } from "lucide-react";

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "projects:read": "Lire les projets",
  "tickets:read": "Lire les tickets",
  "tickets:write": "Créer / modifier les tickets",
  "comments:write": "Commenter les tickets",
  "stats:read": "Lire les statistiques",
  "finance:read": "Lire les finances (CA, URSSAF, net) — admin",
  "documents:read": "Lire les factures & devis",
  "documents:write": "Créer des brouillons de factures/devis — admin",
};

function RevokeButton({ keyId }: { keyId: string }) {
  const [, formAction, pending] = useActionState(revokeApiKeyAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="keyId" value={keyId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Révocation…" : "Révoquer"}
      </Button>
    </form>
  );
}

export function ApiKeyManager({
  keys,
}: {
  keys: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: string | null;
    revokedAt: string | null;
  }[];
}) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, undefined);
  const [dismissed, setDismissed] = useState(false);

  const showRawKey = state?.rawKey && !dismissed;

  return (
    <div className="space-y-6">
      {showRawKey && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              Clé « {state.name} » créée
            </CardTitle>
            <CardDescription>
              Copiez-la maintenant : elle ne sera plus jamais affichée.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all">
              {state.rawKey}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(state.rawKey!);
                toast.success("Clé copiée");
              }}
            >
              <Copy className="size-4 mr-1" /> Copier
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Fermer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouvelle clé</CardTitle>
          <CardDescription>
            Pour connecter votre agent IA (MCP) ou d&apos;autres outils
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="key-name">Nom</Label>
              <Input
                id="key-name"
                name="name"
                placeholder="Ex : Agent IA"
                required
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Permissions</legend>
              {Object.entries(SCOPE_DESCRIPTIONS).map(([scope, label]) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope}
                    defaultChecked={scope.endsWith(":read")}
                    className="rounded border-input"
                  />
                  <code className="text-xs bg-muted px-1 rounded">{scope}</code>
                  <span className="text-muted-foreground">{label}</span>
                </label>
              ))}
            </fieldset>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer la clé"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clés existantes</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune clé.</p>
          ) : (
            <ul className="space-y-3">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <p className={k.revokedAt ? "line-through text-muted-foreground" : "font-medium"}>
                      {k.name}{" "}
                      <code className="text-xs text-muted-foreground">
                        {k.prefix}…
                      </code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {k.scopes.join(", ")}
                      {k.lastUsedAt
                        ? ` · utilisée le ${new Date(k.lastUsedAt).toLocaleDateString("fr-FR")}`
                        : " · jamais utilisée"}
                      {k.revokedAt ? " · révoquée" : ""}
                    </p>
                  </div>
                  {!k.revokedAt && <RevokeButton keyId={k.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
