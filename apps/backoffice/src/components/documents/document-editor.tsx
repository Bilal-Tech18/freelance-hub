"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createDocumentAction,
  updateDocumentAction,
} from "@/lib/actions/documents";
import { computeTotals, type LineItem } from "@/lib/documents";
import { formatEUR } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; name: string };

export function DocumentEditor({
  mode,
  id,
  type,
  clients,
  projects,
  defaultVatRate,
  defaultClientId,
  defaultProjectId,
  initial,
}: {
  mode: "create" | "edit";
  id?: string;
  type: "INVOICE" | "QUOTE";
  clients: Option[];
  projects: {
    id: string;
    name: string;
    clientId: string;
    totalHt?: number | null;
    receivedHt?: number | null;
    remainingHt?: number | null;
    versions?: { id: string; label: string; totalHt: number; receivedHt: number }[];
  }[];
  defaultVatRate: number;
  defaultClientId?: string;
  defaultProjectId?: string;
  initial?: {
    clientId: string;
    projectId: string | null;
    versionId?: string | null;
    activity?: "SERVICE_BNC" | "GOODS";
    vatRate: number;
    items: LineItem[];
    notes: string | null;
  };
}) {
  const action = mode === "create" ? createDocumentAction : updateDocumentAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? defaultProjectId ?? "");
  const [vatRate, setVatRate] = useState(initial?.vatRate ?? defaultVatRate);
  const [items, setItems] = useState<LineItem[]>(
    initial?.items ?? [{ description: "", quantity: 1, unitPrice: 0 }]
  );

  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const selectedProject = projects.find((p) => p.id === projectId);

  // Versions cochées : par défaut celles qui ne sont pas soldées, pour que
  // « Déjà encaissé » ne recompte pas une v1 réglée et facturée depuis longtemps.
  function defaultVersionIds(pid: string, versionId?: string | null) {
    const versions = projects.find((p) => p.id === pid)?.versions ?? [];
    if (versionId && versions.some((v) => v.id === versionId)) return [versionId];
    return versions.filter((v) => v.receivedHt < v.totalHt - 0.005).map((v) => v.id);
  }
  const [versionIds, setVersionIds] = useState<string[]>(() =>
    defaultVersionIds(initial?.projectId ?? defaultProjectId ?? "", initial?.versionId)
  );
  const projectVersions = selectedProject?.versions ?? [];
  const pickedVersions = projectVersions.filter((v) => versionIds.includes(v.id));
  // Aucune version cochée → montants du projet entier (comportement historique).
  const summary =
    selectedProject && pickedVersions.length > 0
      ? (() => {
          const totalHt = pickedVersions.reduce((s, v) => s + v.totalHt, 0);
          const receivedHt = pickedVersions.reduce((s, v) => s + v.receivedHt, 0);
          return {
            name: `${selectedProject.name} ${pickedVersions.map((v) => v.label).join(" + ")}`,
            totalHt,
            receivedHt,
            remainingHt: Math.round((totalHt - receivedHt) * 100) / 100,
          };
        })()
      : selectedProject &&
          selectedProject.totalHt != null &&
          selectedProject.receivedHt != null &&
          selectedProject.remainingHt != null
        ? {
            name: selectedProject.name,
            totalHt: selectedProject.totalHt,
            receivedHt: selectedProject.receivedHt,
            remainingHt: selectedProject.remainingHt,
          }
        : null;

  function toggleVersion(id: string) {
    setVersionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  const totals = useMemo(() => computeTotals(items, vatRate), [items, vatRate]);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  /**
   * Reporte un montant du projet sur la première ligne. Les lignes suivantes
   * sont conservées, et une description déjà saisie n'est jamais écrasée.
   */
  function applyAmount(amountHt: number, label: string) {
    setItems((arr) => {
      const [first, ...rest] = arr.length
        ? arr
        : [{ description: "", quantity: 1, unitPrice: 0 }];
      return [
        {
          description: first.description.trim() || label,
          quantity: 1,
          unitPrice: amountHt,
        },
        ...rest,
      ];
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {mode === "create" && <input type="hidden" name="type" value={type} />}
      {mode === "edit" && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Card>
        <CardHeader>
          <CardTitle>Destinataire</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Client</Label>
            <input type="hidden" name="clientId" value={clientId} />
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setProjectId("");
                setVersionIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un client" />
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
            <Label>Projet (optionnel)</Label>
            <input type="hidden" name="projectId" value={projectId} />
            {/* Rattachée en base seulement si elle porte sur UNE version. */}
            <input
              type="hidden"
              name="versionId"
              value={pickedVersions.length === 1 ? pickedVersions[0].id : ""}
            />
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setVersionIds(defaultVersionIds(v));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                {clientProjects.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Aucun projet pour ce client
                  </SelectItem>
                ) : (
                  clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {summary && (
                <div className="space-y-1 rounded-md border bg-muted/40 px-2.5 py-2 text-xs">
                  {projectVersions.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 border-b pb-1.5">
                      {projectVersions.map((v) => (
                        <label key={v.id} className="inline-flex cursor-pointer items-center gap-1">
                          <input
                            type="checkbox"
                            checked={versionIds.includes(v.id)}
                            onChange={() => toggleVersion(v.id)}
                            className="size-3.5 accent-primary"
                          />
                          <span className="font-medium">{v.label}</span>
                          {v.receivedHt >= v.totalHt - 0.005 && (
                            <span className="text-emerald-600">payée</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">
                      {pickedVersions.length > 0 ? "Total versions" : "Total projet"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        applyAmount(summary.totalHt, summary.name)
                      }
                      className="font-medium underline decoration-dotted underline-offset-2 hover:text-primary"
                    >
                      {formatEUR(summary.totalHt)} HT
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">Déjà encaissé</span>
                    {summary.receivedHt > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          applyAmount(
                            summary.receivedHt,
                            `Acompte — ${summary.name}`
                          )
                        }
                        title="Facturer ce qui a déjà été réglé"
                        className="font-medium text-emerald-600 underline decoration-dotted underline-offset-2 hover:text-primary"
                      >
                        {formatEUR(summary.receivedHt)} HT
                      </button>
                    ) : (
                      <span className="font-medium text-muted-foreground">
                        {formatEUR(summary.receivedHt)} HT
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">
                      {summary.remainingHt < 0
                        ? "Trop-perçu"
                        : "Restant à payer"}
                    </span>
                    {summary.remainingHt < 0 ? (
                      <span className="font-medium text-red-600">
                        {formatEUR(-summary.remainingHt)} HT
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          applyAmount(
                            summary.remainingHt,
                            `Solde — ${summary.name}`
                          )
                        }
                        className={`font-medium underline decoration-dotted underline-offset-2 hover:text-primary ${
                          summary.remainingHt > 0 ? "text-amber-600" : ""
                        }`}
                      >
                        {formatEUR(summary.remainingHt)} HT
                      </button>
                    )}
                  </div>
                  <p className="pt-0.5 text-[11px] text-muted-foreground">
                    {summary.remainingHt < 0
                      ? "Ce projet est déjà encaissé au-delà de son total : facturer encore gonflerait ton CA."
                      : "Clique un montant pour le reporter sur la première ligne."}
                  </p>
                </div>
              )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vatRate">TVA (%)</Label>
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Nature</Label>
            <Select name="activity" defaultValue={initial?.activity ?? "SERVICE_BNC"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SERVICE_BNC">Prestations (BNC)</SelectItem>
                <SelectItem value="GOODS">Vente de marchandises</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="w-24 text-right">Quantité</TableHead>
                <TableHead className="w-32 text-right">Prix U (HT)</TableHead>
                <TableHead className="w-28 text-right">Total HT</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell className="pl-0">
                    <Input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(i, { quantity: Number(e.target.value) })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) =>
                        updateItem(i, { unitPrice: Number(e.target.value) })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatEUR(it.quantity * it.unitPrice)}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setItems((arr) => arr.filter((_, idx) => idx !== i))
                      }
                      disabled={items.length === 1}
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((arr) => [...arr, { description: "", quantity: 1, unitPrice: 0 }])
            }
          >
            <Plus className="size-4 mr-1" /> Ajouter une ligne
          </Button>

          <div className="border-t pt-3 space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span>{formatEUR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA ({vatRate}%)</span>
              <span>{formatEUR(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total TTC</span>
              <span>{formatEUR(totals.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : mode === "create"
            ? "Créer le brouillon"
            : "Enregistrer"}
      </Button>
    </form>
  );
}
