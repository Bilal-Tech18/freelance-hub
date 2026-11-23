import { describe, expect, it } from "vitest";
import {
  addDays,
  describeRecurrence,
  isOccurrence,
  occurrencesBetween,
  parisNow,
  weekdayIndex,
  type RecurringTask,
} from "./recurrence";

const task = (t: Partial<RecurringTask>): RecurringTask => ({
  startDate: "2026-01-31",
  recurrence: "NONE",
  interval: 1,
  endDate: null,
  ...t,
});

describe("occurrencesBetween", () => {
  it("tâche ponctuelle : uniquement sa date", () => {
    const t = task({ startDate: "2026-11-23" });
    expect(occurrencesBetween(t, "2026-11-01", "2026-11-30")).toEqual(["2026-11-23"]);
    expect(occurrencesBetween(t, "2026-12-01", "2026-12-31")).toEqual([]);
  });

  it("quotidienne avec intervalle, à partir d'une fenêtre décalée", () => {
    const t = task({ startDate: "2026-11-01", recurrence: "DAILY", interval: 3 });
    expect(occurrencesBetween(t, "2026-11-05", "2026-11-14")).toEqual([
      "2026-11-07",
      "2026-11-10",
      "2026-11-13",
    ]);
  });

  it("hebdomadaire : même jour de la semaine, traverse le changement d'heure", () => {
    const t = task({ startDate: "2026-10-19", recurrence: "WEEKLY", interval: 1 });
    const days = occurrencesBetween(t, "2026-10-20", "2026-11-10");
    expect(days).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(days.every((d) => weekdayIndex(d) === 0)).toBe(true);
  });

  it("mensuelle : le 31 est ramené au dernier jour puis revient au 31", () => {
    const t = task({ startDate: "2026-01-31", recurrence: "MONTHLY" });
    expect(occurrencesBetween(t, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("mensuelle démarrée un dernier jour de mois : reste en fin de mois", () => {
    const t = task({ startDate: "2026-11-30", recurrence: "MONTHLY" });
    expect(occurrencesBetween(t, "2026-11-01", "2027-03-31")).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("tous les 3 mois, fenêtre loin dans le futur", () => {
    const t = task({ startDate: "2026-02-15", recurrence: "MONTHLY", interval: 3 });
    expect(occurrencesBetween(t, "2027-01-01", "2027-12-31")).toEqual([
      "2027-02-15",
      "2027-05-15",
      "2027-08-15",
      "2027-11-15",
    ]);
  });

  it("annuelle : 29 février → 28 les années non bissextiles", () => {
    const t = task({ startDate: "2028-02-29", recurrence: "YEARLY" });
    expect(occurrencesBetween(t, "2029-01-01", "2032-12-31")).toEqual([
      "2029-02-28",
      "2030-02-28",
      "2031-02-28",
      "2032-02-29",
    ]);
  });

  it("respecte la date de fin et ne commence pas avant startDate", () => {
    const t = task({
      startDate: "2026-11-10",
      recurrence: "DAILY",
      endDate: "2026-11-12",
    });
    expect(occurrencesBetween(t, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
  });
});

describe("helpers", () => {
  it("isOccurrence", () => {
    const t = task({ startDate: "2026-11-02", recurrence: "WEEKLY", interval: 2 });
    expect(isOccurrence(t, "2026-11-16")).toBe(true);
    expect(isOccurrence(t, "2026-11-09")).toBe(false);
  });

  it("addDays traverse les mois", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
  });

  it("describeRecurrence", () => {
    expect(describeRecurrence("MONTHLY", 1)).toBe("Tous les mois");
    expect(describeRecurrence("WEEKLY", 2)).toBe("Tous les 2 semaines");
  });

  it("parisNow convertit vers l'heure de Paris", () => {
    // 23:30 UTC le 31/12 = 00:30 le 01/01 à Paris (hiver, UTC+1)
    expect(parisNow(new Date("2026-12-31T23:30:00Z"))).toEqual({
      day: "2027-01-01",
      time: "00:30",
    });
  });
});
