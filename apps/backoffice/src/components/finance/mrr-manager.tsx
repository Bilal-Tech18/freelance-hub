"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteRecurringRevenueAction,
  saveRecurringRevenueAction,
  type ActionState,
} from "@/lib/actions/mrr";
import { formatEUR } from "@/lib/finance";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workingDaysInMonth } from "@/lib/working-days";
import { Pencil, Repeat, Trash2, X } from "lucide-react";

export type MrrItem = {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  amountHt: number; // fixe : par mois ; DAILY : TJM
  mode: "FIXED" | "DAILY";
  activity: "SERVICE_BNC" | "GOODS";
  startsOn: string; // "YYYY-MM"
  endsOn: string | null;
  activeNow: boolean;
};

const monthLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
});

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return monthLabelFmt.format(new Date(y, m - 1, 1));
}

/**
 * Gestion des revenus récurrents mensuels (maintenance, full-time…).
 * Alimente les prévisions de la page : chaque MRR est attendu tous les mois
 * de sa période, sauf si une facture couvre déjà le client sur le mois.
 */
export function MrrManager({
  clients,
  items,
  currentMonth, // "YYYY-MM"
}: {
  clients: { id: string; name: string }[];
  items: MrrItem[];
  currentMonth: string;
}) {
  const [editing, setEditing] = useState<MrrItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Contrôlé pour adapter le libellé du montant (fixe/mois vs TJM/jour).
  const [mode, setMode] = useState<"FIXED" | "DAILY">("FIXED");
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    // Toast + fermeture du formulaire à la réussite, sans passer par un effet.
    async (prev: ActionState, formData: FormData) => {
      const result = await saveRecurringRevenueAction(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Revenu récurrent enregistré");
        setEditing(null);
        setFormOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    undefined
  );

  function remove(item: MrrItem) {
    startTransition(async () => {
      const result = await deleteRecurringRevenueAction(item.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`${item.clientName} · ${item.label} supprimé`);
    });
  }

  const [y, mo] = currentMonth.split("-").map(Number);
  const daysNow = workingDaysInMonth(y, mo);
  const monthlyOf = (i: MrrItem) =>
    i.mode === "DAILY" ? i.amountHt * daysNow : i.amountHt;
  const mrrNow = items
    .filter((i) => i.activeNow)
    .reduce((s, i) => s + monthlyOf(i), 0);
  const showForm = formOpen || editing !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="size-4" />
          Revenus récurrents (MRR)
        </CardTitle>
        <CardDescription>
          Facturation mensuelle prévue par client : montant fixe (maintenance…)
          ou TJM × jours ouvrés du mois (régie/full-time, lun-ven hors fériés).
          <strong> Sans doublon</strong> : dès qu&apos;une facture est émise pour
          le client sur un mois, elle fait foi et remplace le récurrent dans la
          prévision.
          {mrrNow > 0 && (
            <>
              {" "}
              MRR attendu ce mois-ci ({daysNow} j ouvrés) :{" "}
              <strong>{formatEUR(mrrNow)} HT</strong>.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length > 0 && (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm ${
                  item.activeNow ? "" : "text-muted-foreground"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium">{item.clientName}</span>{" "}
                  <span className="text-muted-foreground">· {item.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.activity === "GOODS" ? "ventes" : "BNC"} · depuis{" "}
                    {monthLabel(item.startsOn)}
                    {item.endsOn
                      ? ` → ${monthLabel(item.endsOn)}`
                      : " (sans fin)"}
                    {!item.activeNow && " · inactif ce mois-ci"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-right">
                    <span className="font-medium tabular-nums">
                      {item.mode === "DAILY"
                        ? `${formatEUR(item.amountHt)} /jour`
                        : `${formatEUR(item.amountHt)} /mois`}
                    </span>
                    {item.mode === "DAILY" && item.activeNow && (
                      <span className="block text-xs text-muted-foreground">
                        ≈ {formatEUR(item.amountHt * daysNow)} ce mois ({daysNow} j)
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditing(item);
                      setMode(item.mode);
                      setFormOpen(true);
                    }}
                    aria-label={`Modifier ${item.label}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(item)}
                    aria-label={`Supprimer ${item.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {!showForm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMode("FIXED");
              setFormOpen(true);
            }}
          >
            <Repeat className="size-4 mr-1" /> Ajouter un revenu récurrent
          </Button>
        ) : (
          <form
            ref={formRef}
            action={formAction}
            // Remount à chaque cible d'édition pour recharger les defaultValue.
            key={editing?.id ?? "new"}
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-1.5">
              <Label>Client</Label>
              <Select name="clientId" defaultValue={editing?.clientId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisissez un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mrr-label">Libellé</Label>
              <Input
                id="mrr-label"
                name="label"
                required
                minLength={2}
                placeholder="Maintenance, régie…"
                defaultValue={editing?.label}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Facturation</Label>
              <Select
                name="mode"
                value={mode}
                onValueChange={(v) => setMode(v as "FIXED" | "DAILY")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Montant fixe / mois</SelectItem>
                  <SelectItem value="DAILY">
                    Au jour ouvré (TJM × jours du mois)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mrr-amount">
                {mode === "DAILY" ? "TJM HT / jour" : "Montant HT / mois"}
              </Label>
              <Input
                id="mrr-amount"
                name="amountHt"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder={mode === "DAILY" ? "400" : "200"}
                defaultValue={editing?.amountHt}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Activité</Label>
              <Select name="activity" defaultValue={editing?.activity ?? "SERVICE_BNC"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICE_BNC">Prestations BNC</SelectItem>
                  <SelectItem value="GOODS">Ventes de marchandises</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mrr-start">Premier mois</Label>
              <Input
                id="mrr-start"
                name="startsOn"
                type="month"
                required
                defaultValue={editing?.startsOn ?? currentMonth}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mrr-end">Dernier mois (optionnel)</Label>
              <Input
                id="mrr-end"
                name="endsOn"
                type="month"
                defaultValue={editing?.endsOn ?? ""}
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
                {state.error}
              </p>
            )}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending
                  ? "Enregistrement…"
                  : editing
                    ? "Enregistrer"
                    : "Ajouter"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(false);
                }}
                disabled={pending}
              >
                <X className="size-3.5 mr-1" /> Annuler
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
