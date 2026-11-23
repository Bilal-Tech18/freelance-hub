import { describe, expect, it } from "vitest";
import { fiscalTask, nextFiscalDueDate } from "./fiscal-deadlines";
import { occurrencesBetween } from "./recurrence";

describe("nextFiscalDueDate", () => {
  it("URSSAF mensuelle : fin du mois courant", () => {
    expect(nextFiscalDueDate("URSSAF", "MONTHLY", "2026-11-23")).toBe("2026-11-30");
    expect(nextFiscalDueDate("URSSAF", "MONTHLY", "2026-11-30")).toBe("2026-11-30");
  });

  it("TVA mensuelle : le 24, sinon le mois suivant", () => {
    expect(nextFiscalDueDate("TVA", "MONTHLY", "2026-11-23")).toBe("2026-11-24");
    expect(nextFiscalDueDate("TVA", "MONTHLY", "2026-11-25")).toBe("2026-12-24");
  });

  it("trimestriel : janvier / avril / juillet / octobre", () => {
    expect(nextFiscalDueDate("URSSAF", "QUARTERLY", "2026-11-23")).toBe("2027-01-31");
    expect(nextFiscalDueDate("TVA", "QUARTERLY", "2026-04-10")).toBe("2026-04-24");
  });
});

describe("fiscalTask", () => {
  it("URSSAF trimestrielle tombe le dernier jour d'avril, juillet, octobre, janvier", () => {
    const task = fiscalTask("URSSAF", "QUARTERLY", "2026-11-23");
    expect(occurrencesBetween(task, "2027-01-01", "2027-12-31")).toEqual([
      "2027-01-31",
      "2027-04-30",
      "2027-07-31",
      "2027-10-31",
    ]);
  });

  it("URSSAF mensuelle démarrée un 30 reste en fin de mois", () => {
    const task = fiscalTask("URSSAF", "MONTHLY", "2026-11-23");
    expect(occurrencesBetween(task, "2026-11-01", "2027-02-28")).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
  });

  it("TVA mensuelle le 24 de chaque mois", () => {
    const task = fiscalTask("TVA", "MONTHLY", "2026-11-25");
    expect(occurrencesBetween(task, "2026-12-01", "2027-02-28")).toEqual([
      "2026-12-24",
      "2027-01-24",
      "2027-02-24",
    ]);
  });
});
