// Échéances déclaratives URSSAF / TVA proposées dans le calendrier. Mêmes
// dates que la checklist de /admin/finance : URSSAF le dernier jour du mois
// suivant la période, TVA (CA3) le 24 du mois suivant.

export type FiscalKind = "URSSAF" | "TVA";
export type FiscalPeriod = "NONE" | "MONTHLY" | "QUARTERLY";

export const FISCAL_PERIOD_LABELS: Record<FiscalPeriod, string> = {
  NONE: "Non concerné",
  MONTHLY: "Mensuelle",
  QUARTERLY: "Trimestrielle",
};

const TVA_DAY = 24;
// Trimestriel : déclaration en janvier, avril, juillet et octobre.
const QUARTER_DUE_MONTHS = [1, 4, 7, 10];

const pad = (n: number) => String(n).padStart(2, "0");

function dueDate(kind: FiscalKind, year: number, month: number) {
  const day = kind === "URSSAF" ? new Date(Date.UTC(year, month, 0)).getUTCDate() : TVA_DAY;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Prochaine échéance (aujourd'hui inclus) pour ce type et cette périodicité. */
export function nextFiscalDueDate(kind: FiscalKind, period: Exclude<FiscalPeriod, "NONE">, today: string) {
  let [year, month] = today.split("-").map(Number);
  for (;;) {
    if (period === "MONTHLY" || QUARTER_DUE_MONTHS.includes(month)) {
      const due = dueDate(kind, year, month);
      if (due >= today) return due;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/** Tâche de calendrier correspondant à l'échéance choisie. */
export function fiscalTask(kind: FiscalKind, period: Exclude<FiscalPeriod, "NONE">, today: string) {
  const quarterly = period === "QUARTERLY";
  const scope = quarterly ? "du trimestre précédent" : "du mois précédent";
  const base = {
    startDate: nextFiscalDueDate(kind, period, today),
    time: null,
    recurrence: "MONTHLY" as const,
    interval: quarterly ? 3 : 1,
    endDate: null,
  };
  if (kind === "URSSAF") {
    return {
      ...base,
      title: `Déclaration URSSAF ${quarterly ? "trimestrielle" : "mensuelle"}`,
      notes: `Déclarer et payer le CA encaissé ${scope} sur autoentrepreneur.urssaf.fr.`,
    };
  }
  return {
    ...base,
    title: `Déclaration de TVA ${quarterly ? "trimestrielle" : "mensuelle"} (CA3)`,
    notes: `Déclarer et payer la TVA ${scope} dans l'espace professionnel impots.gouv.fr. Date limite exacte : voir votre échéancier fiscal.`,
  };
}

/** Périodicité déduite d'une tâche existante (interval 3 = trimestriel). */
export function fiscalPeriodOf(task: { interval: number } | undefined): FiscalPeriod {
  if (!task) return "NONE";
  return task.interval === 3 ? "QUARTERLY" : "MONTHLY";
}
