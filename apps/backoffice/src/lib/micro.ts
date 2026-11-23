/**
 * Calculs micro-entrepreneur : cotisations URSSAF et estimation d'impôt.
 * Deux activités : prestations de services (BNC) et vente de marchandises
 * (BIC). Montants indicatifs — ne remplace pas une déclaration réelle.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cotisations URSSAF : taux (%) appliqué au CA encaissé. */
export function computeUrssaf(caHt: number, ratePct: number): number {
  return round2((caHt * ratePct) / 100);
}

export function netAfterUrssaf(caHt: number, ratePct: number): number {
  return round2(caHt - computeUrssaf(caHt, ratePct));
}

/** Plafonds de CA micro-entreprise 2026-2028 (HT encaissé, LF 2026). */
export const MICRO_CEILING_YEAR = 2026;
export const MICRO_CEILING_BNC = 83_600;
export const MICRO_CEILING_GOODS = 203_100;

/** Abattements forfaitaires : 34 % en BNC, 71 % en vente de marchandises (min 305 €). */
export const MICRO_BNC_ABATEMENT = 0.34;
export const MICRO_GOODS_ABATEMENT = 0.71;
const ABATEMENT_MIN = 305;

function baseFor(ca: number, abattementRate: number): number {
  if (ca <= 0) return 0;
  const abattement = Math.max(ca * abattementRate, ABATEMENT_MIN);
  return Math.max(0, ca - abattement);
}

/** Base imposable totale : chaque activité a son propre abattement. */
export function taxableBase(caBnc: number, caGoods = 0): number {
  return round2(baseFor(caBnc, MICRO_BNC_ABATEMENT) + baseFor(caGoods, MICRO_GOODS_ABATEMENT));
}

/** Barème progressif IR 2026 (LF 2026, revenus 2025), pour 1 part — indicatif. */
export const IR_BAREME_YEAR = 2026;
export const IR_BRACKETS = [
  { upTo: 11_600, rate: 0 },
  { upTo: 29_579, rate: 0.11 },
  { upTo: 84_577, rate: 0.3 },
  { upTo: 181_917, rate: 0.41 },
  { upTo: Infinity, rate: 0.45 },
];

/** Impôt au barème sur la base imposable (1 part, hors autres revenus). */
export function incomeTaxBareme(base: number): number {
  let tax = 0;
  let previous = 0;
  for (const { upTo, rate } of IR_BRACKETS) {
    if (base <= previous) break;
    tax += (Math.min(base, upTo) - previous) * rate;
    previous = upTo;
  }
  return round2(tax);
}

/** Versement libératoire de l'IR : 2,2 % du CA en BNC, 1 % en ventes. */
export const VL_RATE = 0.022;
export const VL_RATE_GOODS = 0.01;

export function incomeTaxLiberatoire(caBnc: number, caGoods = 0): number {
  return round2(caBnc * VL_RATE + caGoods * VL_RATE_GOODS);
}
