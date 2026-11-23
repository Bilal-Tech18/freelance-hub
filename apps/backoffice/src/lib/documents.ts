import { z } from "zod";

export type DocumentType = "INVOICE" | "QUOTE";
export type DocumentStatus =
  | "DRAFT"
  | "ISSUED"
  | "ACCEPTED"
  | "REFUSED"
  | "PAID"
  | "CANCELLED";

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description requise").max(500),
  quantity: z.coerce.number().positive().max(100000),
  unitPrice: z.coerce.number().min(0).max(10_000_000), // PU HT
});
export type LineItem = z.infer<typeof lineItemSchema>;

export const itemsSchema = z.array(lineItemSchema).min(1, "Au moins une ligne");

export function computeTotals(items: LineItem[], vatRate: number) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round2(
    items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  );
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}

/**
 * Numérotation par jour d'émission (UTC) : `F-AAMMJJNNN`, NNN = rang du
 * document dans la journée (001 → 999). Chaque jour est une série continue,
 * sans trou — exigence de l'art. 242 nonies A ann. II CGI — et la date se lit
 * dans le numéro. Les numéros émis avant ce format (F-2026-0001…) restent tels quels.
 *
 * `seq` en base vaut MMJJ × 1000 + NNN : unique par (type, année), et toujours
 * supérieur aux anciens seq 1…9999 tant que MMJJ ≥ 0101.
 */
export const DOC_SEQ_PER_DAY = 999;

export function docDayKey(date: Date) {
  const year = date.getUTCFullYear();
  const mmdd = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  return { year, minSeq: mmdd * 1000 + 1, maxSeq: mmdd * 1000 + DOC_SEQ_PER_DAY };
}

export function formatDocNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${String(year % 100).padStart(2, "0")}${String(seq).padStart(7, "0")}`;
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: "Facture",
  QUOTE: "Devis",
};

export const DOC_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émis",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

export const DOC_STATUS_CLASS: Record<DocumentStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REFUSED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800",
};

/** Facture émise dont l'échéance est dépassée (statut dérivé, jamais stocké). */
export function isDocOverdue(doc: {
  type: DocumentType | string;
  status: DocumentStatus | string;
  dueDate: Date | null;
}): boolean {
  return (
    doc.type === "INVOICE" &&
    doc.status === "ISSUED" &&
    doc.dueDate !== null &&
    doc.dueDate.getTime() < Date.now()
  );
}

export const OVERDUE_LABEL = "En retard";
export const OVERDUE_CLASS =
  "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";

/** Mentions légales TVA selon la config émetteur. */
export function vatLegalMention(vatExempt: boolean): string {
  return vatExempt
    ? "TVA non applicable, art. 293 B du CGI"
    : "TVA acquittée sur les débits";
}

/** Mentions de retard de paiement (obligatoires entre professionnels). */
export const LATE_PAYMENT_MENTION =
  "En cas de retard de paiement, application de pénalités au taux de 3 fois le taux d'intérêt légal, majorées d'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce). Escompte pour paiement anticipé : néant.";
