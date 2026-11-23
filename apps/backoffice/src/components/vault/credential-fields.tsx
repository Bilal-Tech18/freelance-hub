"use client";

import { useState } from "react";
import { providerFields } from "@/lib/credentials";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

/**
 * Rend les champs d'un provider et sérialise leurs valeurs dans un input caché
 * `fields` (JSON) — consommé par les server actions (chiffrement côté serveur).
 */
export function CredentialFields({
  provider,
  values,
  fieldName = "fields",
}: {
  provider: string;
  values?: Record<string, string>;
  fieldName?: string;
}) {
  const fields = providerFields(provider);
  const [data, setData] = useState<Record<string, string>>(values ?? {});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  function update(key: string, value: string) {
    setData((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={fieldName} value={JSON.stringify(data)} />
      {fields.map((f) => (
        <div key={f.key} className="grid gap-1.5">
          <Label htmlFor={`cf-${f.key}`}>{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea
              id={`cf-${f.key}`}
              rows={2}
              value={data[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
            />
          ) : f.type === "password" ? (
            <div className="flex gap-2">
              <Input
                id={`cf-${f.key}`}
                type={shown[f.key] ? "text" : "password"}
                autoComplete="off"
                value={data[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
                className="flex-1 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShown((s) => ({ ...s, [f.key]: !s[f.key] }))}
                aria-label={shown[f.key] ? "Masquer" : "Afficher"}
              >
                {shown[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          ) : (
            <Input
              id={`cf-${f.key}`}
              value={data[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
