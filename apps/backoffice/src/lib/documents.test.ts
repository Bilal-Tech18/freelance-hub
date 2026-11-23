import { describe, expect, it } from "vitest";
import { docDayKey, formatDocNumber } from "./documents";

describe("numérotation des documents", () => {
  it("formate F-AAMMJJNNN sur 9 chiffres", () => {
    const { year, minSeq } = docDayKey(new Date("2026-10-25T11:23:00Z"));
    expect(formatDocNumber("F", year, minSeq)).toBe("F-261025001");
    expect(formatDocNumber("F", year, minSeq + 41)).toBe("F-261025042");
  });

  it("garde les zéros de tête en janvier", () => {
    const { year, minSeq, maxSeq } = docDayKey(new Date("2027-01-05T08:00:00Z"));
    expect(formatDocNumber("D", year, minSeq)).toBe("D-270105001");
    expect(formatDocNumber("D", year, maxSeq)).toBe("D-270105999");
  });

  it("prend le jour UTC, pas le jour local", () => {
    // 23h30 à Paris le 31/12 = encore le 31/12 en UTC (22h30)
    expect(docDayKey(new Date("2026-12-31T22:30:00Z")).minSeq).toBe(1231001);
    // 00h30 à Paris le 01/01 = 31/12 23h30 UTC
    expect(docDayKey(new Date("2026-12-31T23:30:00Z")).year).toBe(2026);
  });

  it("reste au-dessus des anciens numéros séquentiels de l'année", () => {
    expect(docDayKey(new Date("2026-01-01T00:00:00Z")).minSeq).toBeGreaterThan(9999);
  });
});
