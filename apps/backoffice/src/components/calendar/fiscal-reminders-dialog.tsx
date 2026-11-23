"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveFiscalRemindersAction } from "@/lib/actions/calendar";
import { FISCAL_PERIOD_LABELS, type FiscalKind, type FiscalPeriod } from "@/lib/fiscal-deadlines";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Landmark } from "lucide-react";
import { REMINDERS } from "./reminder-options";

const KINDS: { kind: FiscalKind; label: string; due: Record<Exclude<FiscalPeriod, "NONE">, string> }[] = [
  {
    kind: "URSSAF",
    label: "Déclaration URSSAF",
    due: {
      MONTHLY: "Dernier jour du mois suivant.",
      QUARTERLY: "Fin janvier, avril, juillet et octobre.",
    },
  },
  {
    kind: "TVA",
    label: "Déclaration de TVA (CA3)",
    due: {
      MONTHLY: "Le 24 du mois suivant.",
      QUARTERLY: "Le 24 janvier, avril, juillet et octobre.",
    },
  },
];

/** Réglage des rappels URSSAF / TVA : mensuels, trimestriels ou aucun. */
export function FiscalRemindersDialog({
  current,
}: {
  current: { URSSAF: FiscalPeriod; TVA: FiscalPeriod; remindDaysBefore: number | null };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [periods, setPeriods] = useState({ URSSAF: current.URSSAF, TVA: current.TVA });
  const [remind, setRemind] = useState(
    current.remindDaysBefore === null ? "none" : String(current.remindDaysBefore)
  );
  const reminderOptions = REMINDERS.some((r) => r.value === remind)
    ? REMINDERS
    : [...REMINDERS, { value: remind, label: `${remind} jours avant` }];

  function save() {
    startTransition(async () => {
      const res = await saveFiscalRemindersAction({
        ...periods,
        remindDaysBefore: remind === "none" ? null : Number(remind),
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Échéances mises à jour");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Réouverture : on repart de l'état enregistré.
        if (next) {
          setPeriods({ URSSAF: current.URSSAF, TVA: current.TVA });
          setRemind(current.remindDaysBefore === null ? "none" : String(current.remindDaysBefore));
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Landmark data-icon="inline-start" className="size-4" />
          URSSAF / TVA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Échéances URSSAF / TVA</DialogTitle>
          <DialogDescription>
            Ajoutez les déclarations au calendrier selon votre périodicité, avec rappel push + email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {KINDS.map(({ kind, label, due }) => (
            <div key={kind} className="grid gap-2">
              <Label>{label}</Label>
              <Select
                value={periods[kind]}
                onValueChange={(v) => setPeriods((p) => ({ ...p, [kind]: v as FiscalPeriod }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FISCAL_PERIOD_LABELS) as FiscalPeriod[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {FISCAL_PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {periods[kind] !== "NONE" && (
                <p className="text-xs text-muted-foreground">
                  {due[periods[kind] as Exclude<FiscalPeriod, "NONE">]}
                </p>
              )}
            </div>
          ))}
          <div className="grid gap-2">
            <Label>Rappel</Label>
            <Select value={remind} onValueChange={setRemind}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reminderOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
