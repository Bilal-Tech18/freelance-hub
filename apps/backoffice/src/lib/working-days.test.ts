import { describe, expect, it } from "vitest";
import {
  easterSunday,
  frenchPublicHolidays,
  workingDaysInMonth,
} from "./working-days";

describe("easterSunday", () => {
  it("calcule les dates de Pâques connues", () => {
    expect(easterSunday(2024).toDateString()).toBe(
      new Date(2024, 2, 31).toDateString() // 31 mars 2024
    );
    expect(easterSunday(2025).toDateString()).toBe(
      new Date(2025, 3, 20).toDateString() // 20 avril 2025
    );
    expect(easterSunday(2026).toDateString()).toBe(
      new Date(2026, 3, 5).toDateString() // 5 avril 2026
    );
  });
});

describe("frenchPublicHolidays", () => {
  it("liste les 11 fériés de 2026, dont les mobiles", () => {
    const days = frenchPublicHolidays(2026).map((d) => d.toDateString());
    expect(days).toHaveLength(11);
    expect(days).toContain(new Date(2026, 3, 6).toDateString()); // lundi de Pâques
    expect(days).toContain(new Date(2026, 4, 14).toDateString()); // Ascension
    expect(days).toContain(new Date(2026, 4, 25).toDateString()); // lundi de Pentecôte
  });
});

describe("workingDaysInMonth", () => {
  it("janvier 2026 : 22 jours de semaine moins le 1er janvier (jeudi)", () => {
    expect(workingDaysInMonth(2026, 1)).toBe(21);
  });
  it("mai 2026 : 21 jours de semaine moins 4 fériés en semaine", () => {
    // 1er mai (ven), 8 mai (ven), Ascension 14 (jeu), Pentecôte 25 (lun)
    expect(workingDaysInMonth(2026, 5)).toBe(17);
  });
  it("août 2026 : 21 jours de semaine, le 15 août tombe un samedi", () => {
    expect(workingDaysInMonth(2026, 8)).toBe(21);
  });
  it("varie bien d'un mois à l'autre", () => {
    const counts = Array.from({ length: 12 }, (_, i) =>
      workingDaysInMonth(2026, i + 1)
    );
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(17);
    expect(Math.max(...counts)).toBeLessThanOrEqual(23);
  });
});
