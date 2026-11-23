"use client";

import { useActionState, useState } from "react";
import {
  addPaymentAction,
  deletePaymentAction,
  setProjectPricingAction,
} from "@/lib/actions/payments";
import { addVersionAction, deleteVersionAction } from "@/lib/actions/versions";
import { formatEUR, PAYMENT_STATUS_LABELS, type ProjectFinancials } from "@/lib/finance";
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
import { Trash2 } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUS_CLASS: Record<ProjectFinancials["status"], string> = {
  UNSET: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  UNPAID: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  OVERPAID: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  paidAt: string;
  note: string | null;
  versionId: string | null;
  vatRate?: number | null; // taux de la facture d'origine, sinon celui du projet
};

type Version = {
  id: string;
  label: string;
  amountHt: number;
  note: string | null;
  documentId: string | null;
  documentNumber: string | null;
};

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className ?? ""}`}>{value}</p>
    </div>
  );
}

function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [, action] = useActionState(deletePaymentAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        aria-label="Supprimer le paiement"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}

type Quote = {
  id: string;
  number: string | null;
  subtotal: number; // HT
  status: string;
};

function DeleteVersionButton({ versionId }: { versionId: string }) {
  const [, action] = useActionState(deleteVersionAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="versionId" value={versionId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label="Supprimer la version"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}

/** Crée une version depuis un devis accepté/émis (consomme le devis). */
function IntegrateQuoteButton({
  projectId,
  quote,
  suggestedLabel,
}: {
  projectId: string;
  quote: Quote;
  suggestedLabel: string;
}) {
  const [state, action, pending] = useActionState(addVersionAction, undefined);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={quote.id} />
      <input type="hidden" name="amountHt" value={quote.subtotal} />
      <input type="hidden" name="label" value={suggestedLabel} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        title={`Créer la version ${suggestedLabel} depuis ce devis`}
      >
        {pending ? "…" : `→ Intégrer en ${suggestedLabel}`}
      </button>
      {state?.error && <span className="text-[11px] text-destructive">{state.error}</span>}
    </form>
  );
}

function AddVersionForm({
  projectId,
  suggestedLabel,
}: {
  projectId: string;
  suggestedLabel: string;
}) {
  const [state, action, pending] = useActionState(addVersionAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-1.5">
        <Label htmlFor="version-label">Version</Label>
        <Input
          id="version-label"
          name="label"
          defaultValue={suggestedLabel}
          className="w-20"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="version-amount">Montant HT (€)</Label>
        <Input
          id="version-amount"
          name="amountHt"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-32"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="version-note">Note</Label>
        <Input
          id="version-note"
          name="note"
          placeholder="avenant, ajout…"
          className="w-44"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "+ Ajouter la version"}
      </Button>
      {state?.error && (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}

export function BillingCard({
  projectId,
  clientId,
  amountHt,
  vatRate,
  financials,
  payments,
  quotes = [],
  versions = [],
}: {
  projectId: string;
  clientId?: string;
  amountHt: number | null;
  vatRate: number;
  financials: ProjectFinancials;
  payments: Payment[];
  quotes?: Quote[];
  versions?: Version[];
}) {
  const [pricingState, pricingAction, pricingPending] = useActionState(
    setProjectPricingAction,
    undefined
  );
  const [payState, payAction, payPending] = useActionState(addPaymentAction, undefined);
  const [method, setMethod] = useState("Virement");
  const [amountValue, setAmountValue] = useState(amountHt != null ? String(amountHt) : "");
  const [paymentVersion, setPaymentVersion] = useState("none");

  const hasVersions = versions.length > 0;
  // Prochain label suggéré : v1, v2, v3… (les intermédiaires v1.1 restent saisissables).
  const suggestedLabel = `v${versions.length + 1}`;
  // Devis déjà consommé par une version → badge au lieu du bouton.
  const versionByQuoteId = new Map(
    versions.filter((v) => v.documentId).map((v) => [v.documentId as string, v])
  );
  const versionById = new Map(versions.map((v) => [v.id, v]));
  // En HT, comme le montant des versions : les encaissements sont TTC.
  const paidByVersion = new Map<string, number>();
  for (const p of payments) {
    if (p.versionId) {
      const ht = p.amount / (1 + (p.vatRate ?? vatRate) / 100);
      paidByVersion.set(p.versionId, (paidByVersion.get(p.versionId) ?? 0) + ht);
    }
  }

  const newQuoteHref = `/admin/documents/new?type=QUOTE${
    clientId ? `&client=${clientId}&project=${projectId}` : ""
  }`;

  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Facturation</CardTitle>
            <CardDescription>Visible par toi uniquement</CardDescription>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[financials.status]}`}
          >
            {PAYMENT_STATUS_LABELS[financials.status]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Montants */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Montant HT" value={formatEUR(financials.ht)} />
          <Stat
            label={`TVA (${vatRate}%)`}
            value={formatEUR(financials.vat)}
          />
          <Stat label="Total TTC" value={formatEUR(financials.ttc)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Encaissé"
            value={formatEUR(financials.declaredReceived)}
            className="text-emerald-600"
          />
          <Stat
            label={financials.overpaid > 0 ? "Trop-perçu" : "Reste à payer"}
            value={formatEUR(
              financials.overpaid > 0 ? financials.overpaid : financials.outstanding
            )}
            className={
              financials.overpaid > 0
                ? "text-red-600"
                : financials.outstanding > 0
                  ? "text-amber-600"
                  : "text-muted-foreground"
            }
          />
        </div>

        {financials.overpaid > 0 && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Ce projet est encaissé {formatEUR(financials.overpaid)} au-dessus de son
            total TTC. Cause la plus fréquente : un encaissement saisi à la main
            <strong> et </strong> une facture marquée payée pour le même argent — le
            CA est alors compté deux fois. Supprime l&apos;encaissement en double
            ci-dessous, ou corrige le montant du projet.
          </p>
        )}

        {/* Versions (tranches) */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">
            Versions
            {hasVersions && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                le montant du projet est la somme des versions
              </span>
            )}
          </p>
          {hasVersions && (
            <ul className="space-y-1">
              {versions.map((v) => {
                const paid = paidByVersion.get(v.id) ?? 0;
                const fullyPaid = paid >= v.amountHt - 0.005;
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {v.label}
                      </span>
                      <span className="font-medium">{formatEUR(v.amountHt)} HT</span>
                      {v.documentId && (
                        <a
                          href={`/admin/documents/${v.documentId}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          devis {v.documentNumber ?? ""}
                        </a>
                      )}
                      {v.note && (
                        <span className="truncate text-xs text-muted-foreground">
                          {v.note}
                        </span>
                      )}
                      <span
                        className={`text-xs ${fullyPaid ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {fullyPaid
                          ? "payée ✓"
                          : `${formatEUR(paid)} / ${formatEUR(v.amountHt)} HT encaissés`}
                      </span>
                    </div>
                    <DeleteVersionButton versionId={v.id} />
                  </li>
                );
              })}
            </ul>
          )}
          <AddVersionForm projectId={projectId} suggestedLabel={suggestedLabel} />
        </div>

        {/* Devis */}
        <div className="space-y-2 border-t pt-4 text-sm">
          {quotes.length === 0 ? (
            <p className="text-muted-foreground">
              Aucun devis lié à ce projet. Créez-en : chaque devis accepté
              pourra être intégré comme version du projet.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {quotes.map((q) => {
                const linked = versionByQuoteId.get(q.id);
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      <a href={`/admin/documents/${q.id}`} className="hover:underline">
                        {q.number ?? "Devis brouillon"}
                      </a>{" "}
                      — {formatEUR(q.subtotal)} HT
                      {q.status === "ACCEPTED"
                        ? " · accepté"
                        : q.status === "ISSUED"
                          ? " · émis"
                          : " · brouillon"}
                    </span>
                    {linked ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ intégré en {linked.label}
                      </span>
                    ) : q.status === "DRAFT" ? (
                      <span className="text-[11px]">(émettre pour intégrer)</span>
                    ) : (
                      <IntegrateQuoteButton
                        projectId={projectId}
                        quote={q}
                        suggestedLabel={suggestedLabel}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={newQuoteHref}>+ Nouveau devis pour ce projet</a>
          </Button>
        </div>

        {/* Montant manuel (legacy, sans versions) + TVA */}
        <form action={pricingAction} className="flex flex-wrap items-end gap-3 border-t pt-4">
          <input type="hidden" name="projectId" value={projectId} />
          {!hasVersions && (
            <div className="grid gap-1.5">
              <Label htmlFor="amountHt">Montant du projet HT (€)</Label>
              <Input
                id="amountHt"
                name="amountHt"
                type="number"
                step="0.01"
                min="0"
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                className="w-40"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="vatRate">TVA (%)</Label>
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={vatRate}
              className="w-24"
            />
          </div>
          <Button type="submit" variant="outline" disabled={pricingPending}>
            {pricingPending ? "…" : hasVersions ? "Enregistrer la TVA" : "Enregistrer le montant"}
          </Button>
          {pricingState?.error && (
            <p className="text-sm text-destructive w-full">{pricingState.error}</p>
          )}
        </form>

        {/* Paiements */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Encaissements</p>
          {payments.length > 0 && (
            <ul className="space-y-1">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatEUR(p.amount)}</span>
                    {p.versionId && versionById.has(p.versionId) && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {versionById.get(p.versionId)!.label}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {p.method ? `${p.method} · ` : ""}
                      {dateFmt.format(new Date(p.paidAt))}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </div>
                  <DeletePaymentButton paymentId={p.id} />
                </li>
              ))}
            </ul>
          )}

          <form action={payAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Montant (€)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-32"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Moyen</Label>
              <Select
                name="method"
                value={method}
                onValueChange={setMethod}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="CB">CB</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="paidAt">Date</Label>
              <Input id="paidAt" name="paidAt" type="date" className="w-40" />
            </div>
            {hasVersions && (
              <div className="grid gap-1.5">
                <Label>Version</Label>
                <input
                  type="hidden"
                  name="versionId"
                  value={paymentVersion === "none" ? "" : paymentVersion}
                />
                <Select value={paymentVersion} onValueChange={setPaymentVersion}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Globale —</SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={payPending}>
              {payPending ? "…" : "Ajouter"}
            </Button>
            {payState?.error && (
              <p className="text-sm text-destructive w-full">{payState.error}</p>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
