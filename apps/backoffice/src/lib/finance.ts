export type PaymentInput = {
  amount: number;
  // Taux de TVA de la facture qui a généré l'encaissement. Absent pour une
  // saisie manuelle : on retombe alors sur le taux du projet. Sans ça, une
  // facture exonérée sur un projet à 20 % voyait son CA reconverti au taux du
  // projet — du HT perdu et de la TVA collectée qui n'a jamais été encaissée.
  vatRate?: number | null;
};

export type ProjectFinancials = {
  ht: number;
  vatRate: number;
  vat: number;
  ttc: number;
  declaredReceived: number; // encaissé (TTC)
  received: number; // total encaissé
  outstanding: number; // reste à payer — NÉGATIF si le projet est sur-encaissé
  overpaid: number; // trop-perçu (0 si le projet n'est pas sur-encaissé)
  declaredHt: number; // CA HT correspondant à l'encaissé déclaré
  vatCollected: number; // TVA encaissée
  status: "UNSET" | "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeProjectFinancials(
  amountHt: number | null,
  vatRate: number,
  payments: PaymentInput[]
): ProjectFinancials {
  const ht = amountHt ?? 0;
  const vat = round2((ht * vatRate) / 100);
  const ttc = round2(ht + vat);

  const declaredReceived = round2(payments.reduce((s, p) => s + p.amount, 0));
  const received = declaredReceived;
  // Volontairement non borné à 0 : un projet sur-encaissé doit se voir, c'est
  // le signe d'un double comptage (encaissement manuel + facture marquée payée).
  const outstanding = round2(ttc - received);
  const overpaid = round2(Math.max(0, -outstanding));

  // Chaque encaissement est reconverti à SON taux, pas à celui du projet.
  const declaredHt = round2(
    payments.reduce((s, p) => s + p.amount / (1 + (p.vatRate ?? vatRate) / 100), 0)
  );
  const vatCollected = round2(declaredReceived - declaredHt);

  let status: ProjectFinancials["status"];
  if (amountHt == null) status = "UNSET";
  else if (overpaid >= 0.01) status = "OVERPAID";
  else if (received <= 0) status = "UNPAID";
  else if (outstanding >= 0.01) status = "PARTIAL";
  else status = "PAID";

  return {
    ht,
    vatRate,
    vat,
    ttc,
    declaredReceived,
    received,
    outstanding,
    overpaid,
    declaredHt,
    vatCollected,
    status,
  };
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formatEUR(n: number): string {
  return eur.format(n);
}

export const PAYMENT_STATUS_LABELS: Record<ProjectFinancials["status"], string> = {
  UNSET: "Non chiffré",
  UNPAID: "Non payé",
  PARTIAL: "Partiel",
  PAID: "Payé",
  OVERPAID: "Sur-encaissé",
};
