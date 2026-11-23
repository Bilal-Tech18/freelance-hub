import { describe, expect, it } from "vitest";
import { computeProjectFinancials } from "./finance";

describe("computeProjectFinancials", () => {
  it("additionne les encaissements et solde un projet payé", () => {
    const f = computeProjectFinancials(1000, 20, [
      { amount: 600 },
      { amount: 600 },
    ]);
    expect(f.ttc).toBe(1200);
    expect(f.declaredReceived).toBe(1200);
    expect(f.outstanding).toBe(0);
    expect(f.overpaid).toBe(0);
    expect(f.status).toBe("PAID");
  });

  it("signale un sur-encaissement au lieu de le masquer", () => {
    // Cas réel : 524 € saisis à la main, puis la facture du total marquée
    // payée. L'ancien calcul bornait le reste à 0 et affichait « Payé ».
    const f = computeProjectFinancials(1750, 20, [
      { amount: 524 },
      { amount: 2100 },
    ]);
    expect(f.ttc).toBe(2100);
    expect(f.received).toBe(2624);
    expect(f.outstanding).toBe(-524);
    expect(f.overpaid).toBe(524);
    expect(f.status).toBe("OVERPAID");
  });

  it("reconvertit chaque encaissement à SON taux de TVA", () => {
    // Facture exonérée (0 %) encaissée sur un projet à 20 % : les 200 € sont
    // du HT pur. Au taux du projet ils n'auraient pesé que 166,67 € de CA.
    const f = computeProjectFinancials(400, 20, [
      { amount: 200, vatRate: 0 },
      { amount: 240, vatRate: 20 },
    ]);
    expect(f.declaredHt).toBe(400);
    expect(f.vatCollected).toBe(40);
  });

  it("retombe sur le taux du projet quand l'encaissement n'en porte pas", () => {
    const manuel = computeProjectFinancials(1000, 20, [
      { amount: 1200 },
    ]);
    const nul = computeProjectFinancials(1000, 20, [
      { amount: 1200, vatRate: null },
    ]);
    expect(manuel.declaredHt).toBe(1000);
    expect(nul.declaredHt).toBe(1000);
  });

  it("laisse un projet non chiffré en UNSET même sur-encaissé", () => {
    const f = computeProjectFinancials(null, 20, [
      { amount: 500 },
    ]);
    expect(f.status).toBe("UNSET");
  });

  it("tolère un résidu de centime sans basculer en PARTIAL", () => {
    const f = computeProjectFinancials(100, 0, [
      { amount: 99.999 },
    ]);
    expect(f.status).toBe("PAID");
  });
});
