"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePaletteAction, resetPaletteAction } from "@/lib/actions/maintenance";
import {
  DEFAULT_MAINTENANCE_PALETTE,
  type Palette,
} from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SLOTS: { key: keyof Palette; label: string; hint: string }[] = [
  { key: "c1", label: "Couleur principale", hint: "Boutons, sidebar, liens actifs" },
  { key: "c2", label: "Accent", hint: "Surbrillances, graphiques" },
  { key: "c3", label: "Teinte douce", hint: "Fonds, hover, bordures" },
  { key: "c4", label: "Surbrillance claire", hint: "Fonds secondaires" },
];

export function PaletteForm({ palette }: { palette: Palette }) {
  const [values, setValues] = useState<Palette>(palette);
  const [state, action, pending] = useActionState(updatePaletteAction, undefined);
  const [resetting, startReset] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.ok) toast.success("Palette enregistrée ✨");
      else if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Palette de couleurs</CardTitle>
        <CardDescription>
          Personnalise les couleurs de ton espace — appliquées partout (clair et
          sombre) dès l&apos;enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {/* Aperçu */}
          <div className="flex h-10 overflow-hidden rounded-md border">
            {SLOTS.map(({ key }) => (
              <div key={key} className="flex-1" style={{ background: values[key] }} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SLOTS.map(({ key, label, hint }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`palette-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`palette-${key}`}
                    type="color"
                    value={values[key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key]: e.target.value }))
                    }
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    aria-label={label}
                  />
                  <Input
                    name={key}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key]: e.target.value }))
                    }
                    pattern="^#[0-9a-fA-F]{6}$"
                    className="font-mono"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Enregistrer"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={resetting}
              onClick={() =>
                startReset(async () => {
                  const res = await resetPaletteAction();
                  if (res?.ok) {
                    setValues(DEFAULT_MAINTENANCE_PALETTE);
                    toast.success("Palette par défaut restaurée");
                  } else if (res?.error) toast.error(res.error);
                })
              }
            >
              Réinitialiser
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
