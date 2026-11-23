"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { saveMonthFinanceAction } from "@/lib/actions/payments";
import { formatEUR } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";

export type MonthDetailItem = {
  label: string;
  sub: string;
  amountHt: number | null;
  counted: boolean; // false = affiché mais hors CA du mois
};

/**
 * Ligne mensuelle du tableau CA.
 * - Clic sur la ligne : déplie le détail de ce qui est compté.
 * - Crayon : édition (CA manuel BNC/ventes + URSSAF réelle), un seul Enregistrer.
 * - Le CA manuel est PRIORITAIRE : il remplace le suivi automatique du mois.
 */
export function MonthRow({
  year,
  month,
  name,
  current,
  future = false,
  bnc,
  goods,
  bncTracked,
  goodsTracked,
  adjBnc,
  adjGoods,
  vat,
  details,
  forecastBnc = 0,
  forecastGoods = 0,
  forecastDetails = [],
  computedUrssaf,
  override,
  net,
}: {
  year: number;
  month: number; // 1-12
  name: string;
  current: boolean;
  /** Mois à venir : la ligne n'affiche que la prévision (pas d'édition). */
  future?: boolean;
  bnc: number; // compté (manuel prioritaire)
  goods: number;
  bncTracked: number; // suivi automatique
  goodsTracked: number;
  adjBnc: number | null;
  adjGoods: number | null;
  /** TVA encaissée sur les mouvements déclarés du mois. */
  vat: number;
  details: MonthDetailItem[];
  /** Prévision : factures émises + MRR (reste attendu pour le mois en cours). */
  forecastBnc?: number;
  forecastGoods?: number;
  forecastDetails?: MonthDetailItem[];
  computedUrssaf: number;
  override: number | null;
  net: number;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, formAction, pending] = useActionState(
    // Toast + sortie du mode édition à la réussite, sans passer par un effet.
    async (prev: Parameters<typeof saveMonthFinanceAction>[0], formData: FormData) => {
      const result = await saveMonthFinanceAction(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${name} enregistré`);
        setEditing(false);
      }
      return result;
    },
    undefined
  );
  const formId = useId();

  const monthLabel = (
    <span className="inline-flex items-center gap-1">
      {expanded ? (
        <ChevronDown className="size-3.5 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-3.5 text-muted-foreground" />
      )}
      {name}
      {current && (
        <span className="ml-1 text-xs text-muted-foreground">(en cours)</span>
      )}
      {future && (
        <span className="ml-1 text-xs text-muted-foreground">(prévu)</span>
      )}
    </span>
  );

  const forecastTotal = forecastBnc + forecastGoods;

  const forecastSection = forecastDetails.length > 0 && (
    <div className="space-y-1">
      <p className="text-xs font-medium text-sky-700 dark:text-sky-400">
        {future ? "Prévision du mois" : "Encore attendu ce mois-ci"}
      </p>
      <ul className="space-y-1">
        {forecastDetails.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">{d.label}</span>{" "}
              <span className="text-xs text-muted-foreground">{d.sub}</span>
            </span>
            <span className="tabular-nums">
              {d.amountHt != null ? `${formatEUR(d.amountHt)} HT` : "—"}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-between gap-3 border-t pt-1 font-medium">
        <span>
          {future ? "Total prévu" : "Total attendu"} : BNC {formatEUR(forecastBnc)} ·
          Ventes {formatEUR(forecastGoods)}
        </span>
        <span>{formatEUR(forecastTotal)} HT</span>
      </p>
    </div>
  );

  const detailRow = expanded && !editing && (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={9} className="bg-muted/20 px-6 py-3">
        <div className="space-y-2 text-sm">
          {details.length === 0 &&
          adjBnc == null &&
          adjGoods == null &&
          forecastDetails.length === 0 ? (
            <p className="text-muted-foreground">
              {future
                ? "Rien de prévu ce mois-ci (aucune facture émise ni revenu récurrent)."
                : "Aucun mouvement suivi ce mois-ci."}
            </p>
          ) : future ? (
            forecastSection
          ) : (
            <>
              {details.length > 0 && (
                <ul className="space-y-1">
                  {details.map((d, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between gap-3 ${
                        d.counted ? "" : "text-muted-foreground"
                      }`}
                    >
                      <span>
                        <span className="font-medium">{d.label}</span>{" "}
                        <span className="text-xs text-muted-foreground">{d.sub}</span>
                      </span>
                      <span className={d.counted ? "font-medium" : "line-through"}>
                        {d.amountHt != null ? `${formatEUR(d.amountHt)} HT` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(adjBnc != null || adjGoods != null) && (
                <div className="border-t pt-2 space-y-1">
                  {adjBnc != null && (
                    <p className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          CA manuel BNC
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">
                          prioritaire — remplace le suivi BNC du mois (
                          {formatEUR(bncTracked)})
                        </span>
                      </span>
                      <span className="font-medium">{formatEUR(adjBnc)} HT</span>
                    </p>
                  )}
                  {adjGoods != null && (
                    <p className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          CA manuel ventes
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">
                          prioritaire — remplace le suivi ventes du mois (
                          {formatEUR(goodsTracked)})
                        </span>
                      </span>
                      <span className="font-medium">{formatEUR(adjGoods)} HT</span>
                    </p>
                  )}
                </div>
              )}
              <p className="border-t pt-2 flex items-center justify-between gap-3 font-medium">
                <span>Compté ce mois : BNC {formatEUR(bnc)} · Ventes {formatEUR(goods)}</span>
                <span>{formatEUR(bnc + goods)} HT</span>
              </p>
              {forecastSection && (
                <div className="border-t pt-2">{forecastSection}</div>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  if (!editing) {
    return (
      <>
        <TableRow
          className={`cursor-pointer ${current ? "bg-muted/40" : ""}`}
          onClick={() => setExpanded((v) => !v)}
        >
          <TableCell className={current ? "font-semibold" : ""}>{monthLabel}</TableCell>
          {future ? (
            <>
              {/* Mois à venir : prévision seule (factures émises + MRR), en italique */}
              <TableCell className="text-right italic text-muted-foreground">
                {forecastBnc > 0 ? formatEUR(forecastBnc) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-right italic text-muted-foreground">
                {forecastGoods > 0 ? formatEUR(forecastGoods) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell
                className="text-right italic text-amber-600/60"
                title="URSSAF estimée sur la prévision"
              >
                {forecastTotal > 0 ? formatEUR(computedUrssaf) : "—"}
              </TableCell>
              <TableCell className="text-right italic text-muted-foreground">
                {forecastTotal > 0 ? formatEUR(net) : "—"}
              </TableCell>
              <TableCell className="w-10" />
            </>
          ) : (
            <>
              <TableCell className="text-right">
                {formatEUR(bnc)}
                {current && forecastBnc > 0 && (
                  <span className="block text-xs italic text-sky-700 dark:text-sky-400">
                    +{formatEUR(forecastBnc)} prévu
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {adjBnc != null ? formatEUR(adjBnc) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {formatEUR(goods)}
                {current && forecastGoods > 0 && (
                  <span className="block text-xs italic text-sky-700 dark:text-sky-400">
                    +{formatEUR(forecastGoods)} prévu
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {adjGoods != null ? formatEUR(adjGoods) : "—"}
              </TableCell>
              <TableCell
                className="text-right text-sky-700 dark:text-sky-400"
                title="TVA encaissée sur les paiements déclarés du mois (à reverser)"
              >
                {vat > 0 ? formatEUR(vat) : "—"}
              </TableCell>
              <TableCell
                className={`text-right ${override != null ? "font-medium text-amber-600" : "text-amber-600/80"}`}
                title={override != null ? "Montant corrigé à la main" : "Montant calculé"}
              >
                {formatEUR(override ?? computedUrssaf)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {bnc + goods > 0 ? formatEUR(net) : "—"}
              </TableCell>
              <TableCell className="w-10 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                    setExpanded(false);
                  }}
                  aria-label={`Modifier ${name}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TableCell>
            </>
          )}
        </TableRow>
        {detailRow}
      </>
    );
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell className="font-medium">
        {name}
        {/* Le formulaire vit ici : les inputs des autres cellules y sont reliés via form= */}
        <form id={formId} action={formAction}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
        </form>
      </TableCell>
      <TableCell className="text-right">{formatEUR(bncTracked)}</TableCell>
      <TableCell className="text-right">
        <Input
          form={formId}
          name="adjBnc"
          type="number"
          step="0.01"
          min="0"
          placeholder="0"
          defaultValue={adjBnc ?? ""}
          className="h-8 w-24 ml-auto text-right"
          aria-label="CA manuel BNC (HT), remplace le suivi du mois"
        />
      </TableCell>
      <TableCell className="text-right">{formatEUR(goodsTracked)}</TableCell>
      <TableCell className="text-right">
        <Input
          form={formId}
          name="adjGoods"
          type="number"
          step="0.01"
          min="0"
          placeholder="0"
          defaultValue={adjGoods ?? ""}
          className="h-8 w-24 ml-auto text-right"
          aria-label="CA manuel ventes (HT), remplace le suivi du mois"
        />
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {vat > 0 ? formatEUR(vat) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <Input
          form={formId}
          name="urssaf"
          type="number"
          step="0.01"
          min="0"
          placeholder={computedUrssaf > 0 ? String(computedUrssaf) : "0"}
          defaultValue={override ?? ""}
          className="h-8 w-24 ml-auto text-right"
          aria-label="URSSAF réellement payée"
          title="Vide ou 0 = montant calculé automatiquement"
        />
      </TableCell>
      <TableCell className="text-right font-medium">
        {bnc + goods > 0 ? formatEUR(net) : "—"}
      </TableCell>
      <TableCell className="w-10">
        <span className="flex items-center justify-end gap-1">
          <Button
            type="submit"
            form={formId}
            size="sm"
            className="h-7 px-2"
            disabled={pending}
          >
            {pending ? "…" : (
              <>
                <Check className="size-3.5 mr-1" /> Enregistrer
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setEditing(false)}
            disabled={pending}
            aria-label="Annuler"
          >
            <X className="size-3.5" />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}
