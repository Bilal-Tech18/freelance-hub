// Jours ouvrés (lundi-vendredi, hors jours fériés français) : base des
// prévisions pour la facturation à la journée (régie / full-time).

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Jours fériés français (métropole) de l'année. */
export function frenchPublicHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  const fromEaster = (days: number) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + days);
    return d;
  };
  return [
    new Date(year, 0, 1), // Jour de l'an
    fromEaster(1), // Lundi de Pâques
    new Date(year, 4, 1), // Fête du travail
    new Date(year, 4, 8), // Victoire 1945
    fromEaster(39), // Ascension
    fromEaster(50), // Lundi de Pentecôte
    new Date(year, 6, 14), // Fête nationale
    new Date(year, 7, 15), // Assomption
    new Date(year, 10, 1), // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
  ];
}

/** Nombre de jours ouvrés (lun-ven hors fériés) d'un mois (1-12). */
export function workingDaysInMonth(year: number, month: number): number {
  const holidays = new Set(
    frenchPublicHolidays(year)
      .filter((d) => d.getMonth() === month - 1)
      .map((d) => d.getDate())
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0 || dow === 6 || holidays.has(day)) continue;
    count++;
  }
  return count;
}
