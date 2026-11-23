// Récurrence des tâches du calendrier. Tout se fait sur des dates « YYYY-MM-DD »
// (jour calendaire, sans fuseau) : l'arithmétique passe par UTC pour ne jamais
// glisser d'un jour au changement d'heure.

export type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecurringTask = {
  startDate: string;
  recurrence: Recurrence;
  interval: number;
  endDate: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const RECURRENCE_LABELS: Record<Recurrence, { one: string; many: string }> = {
  NONE: { one: "Une seule fois", many: "" },
  DAILY: { one: "Tous les jours", many: "jours" },
  WEEKLY: { one: "Toutes les semaines", many: "semaines" },
  MONTHLY: { one: "Tous les mois", many: "mois" },
  YEARLY: { one: "Tous les ans", many: "ans" },
};

export function describeRecurrence(recurrence: Recurrence, interval: number) {
  if (recurrence === "NONE" || interval <= 1) return RECURRENCE_LABELS[recurrence].one;
  return `Tous les ${interval} ${RECURRENCE_LABELS[recurrence].many}`;
}

function toUtc(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  return fromUtc(toUtc(day) + days * DAY_MS);
}

/** Lundi = 0 … dimanche = 6. */
export function weekdayIndex(day: string) {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Vrai si la date est le dernier jour de son mois (30/11, 28/02…). */
export function isMonthEnd(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return d === daysInMonth(y, m - 1);
}

/**
 * Même jour du mois `months` plus tard, ramené au dernier jour si le mois est
 * plus court (31 → 30/28). Une série qui démarre un dernier jour de mois
 * reste en fin de mois (30/11 → 31/12 → 31/01 → 28/02…).
 */
function addMonthsClamped(start: string, months: number) {
  const [y, m, d] = start.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const lastDay = daysInMonth(year, month);
  const day = isMonthEnd(start) ? lastDay : Math.min(d, lastDay);
  return fromUtc(Date.UTC(year, month, day));
}

/** Occurrences de la tâche entre `from` et `to` (inclus), triées. */
export function occurrencesBetween(task: RecurringTask, from: string, to: string): string[] {
  const last = task.endDate && task.endDate < to ? task.endDate : to;
  if (task.startDate > last) return [];
  const interval = Math.max(1, task.interval);

  if (task.recurrence === "NONE") {
    return task.startDate >= from ? [task.startDate] : [];
  }

  const result: string[] = [];

  if (task.recurrence === "DAILY" || task.recurrence === "WEEKLY") {
    const stepDays = interval * (task.recurrence === "WEEKLY" ? 7 : 1);
    const start = toUtc(task.startDate);
    const gap = Math.max(0, Math.round((toUtc(from) - start) / DAY_MS));
    let k = Math.ceil(gap / stepDays);
    for (;;) {
      const day = fromUtc(start + k * stepDays * DAY_MS);
      if (day > last) break;
      result.push(day);
      k += 1;
    }
    return result;
  }

  // MONTHLY / YEARLY : on repart toujours de startDate pour garder le jour
  // d'origine (un 31 qui passe par février revient au 31 en mars).
  const stepMonths = interval * (task.recurrence === "YEARLY" ? 12 : 1);
  const [sy, sm] = task.startDate.split("-").map(Number);
  const [fy, fm] = from.split("-").map(Number);
  const monthsGap = Math.max(0, (fy - sy) * 12 + (fm - sm));
  let k = Math.max(0, Math.floor(monthsGap / stepMonths) - 1);
  for (;;) {
    const day = addMonthsClamped(task.startDate, k * stepMonths);
    if (day > last) break;
    if (day >= from) result.push(day);
    k += 1;
  }
  return result;
}

/** Vrai si `day` est une occurrence de la tâche. */
export function isOccurrence(task: RecurringTask, day: string) {
  return occurrencesBetween(task, day, day).length === 1;
}

/** Date du jour et heure courante à Paris : { day: "YYYY-MM-DD", time: "HH:mm" }. */
export function parisNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
