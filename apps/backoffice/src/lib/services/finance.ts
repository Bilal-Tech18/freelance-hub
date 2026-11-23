import "server-only";

import { db } from "@/lib/db";
import {
  computeProjectFinancials,
  formatEUR,
  type PaymentInput,
} from "@/lib/finance";
import { workingDaysInMonth } from "@/lib/working-days";

/**
 * Encaissements Prisma → entrées de calcul. Le `vatRate` de l'encaissement
 * (celui de la facture d'origine) prime partout sur le taux du projet.
 */
export function toPaymentInputs(
  payments: { amount: unknown; vatRate?: unknown }[]
): PaymentInput[] {
  return payments.map((p) => ({
    amount: Number(p.amount),
    vatRate: p.vatRate == null ? null : Number(p.vatRate),
  }));
}

/** Financials d'un projet — ADMIN uniquement (appeler après requireAdmin). */
export async function getProjectFinancials(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!project) return null;

  const payments = toPaymentInputs(project.payments);

  const financials = computeProjectFinancials(
    project.amountHt != null ? Number(project.amountHt) : null,
    Number(project.vatRate),
    payments
  );

  return { project, financials };
}

export type ProjectVersionOption = {
  id: string;
  label: string;
  totalHt: number;
  receivedHt: number; // encaissements rattachés à cette version, en HT
};

export type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  // Tout en HT, comme les lignes d'un document. null si projet non chiffré.
  totalHt: number | null;
  receivedHt: number | null; // déjà encaissé
  remainingHt: number | null; // reste à payer — négatif si sur-encaissé
  versions: ProjectVersionOption[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Projets pour les sélecteurs de documents, avec l'état de paiement — ADMIN uniquement. */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  const projects = await db.project.findMany({
    select: {
      id: true,
      name: true,
      clientId: true,
      amountHt: true,
      vatRate: true,
      payments: { select: { amount: true, vatRate: true, versionId: true } },
      versions: {
        select: { id: true, label: true, amountHt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => {
    const vatRate = Number(p.vatRate);
    // Chaque encaissement est reconverti en HT à SON taux (celui de la facture).
    const paymentHt = (pay: { amount: unknown; vatRate: unknown }) =>
      Number(pay.amount) / (1 + (pay.vatRate == null ? vatRate : Number(pay.vatRate)) / 100);
    const versions = p.versions.map((v) => ({
      id: v.id,
      label: v.label,
      totalHt: Number(v.amountHt),
      receivedHt: round2(
        p.payments.filter((pay) => pay.versionId === v.id).reduce((s, pay) => s + paymentHt(pay), 0)
      ),
    }));
    const base = { id: p.id, name: p.name, clientId: p.clientId, versions };
    if (p.amountHt == null) {
      return { ...base, totalHt: null, receivedHt: null, remainingHt: null };
    }
    const f = computeProjectFinancials(
      Number(p.amountHt),
      vatRate,
      toPaymentInputs(p.payments)
    );
    const toHt = (ttc: number) => Math.round((ttc / (1 + vatRate / 100)) * 100) / 100;
    return {
      ...base,
      totalHt: f.ht,
      receivedHt: toHt(f.received),
      remainingHt: toHt(f.outstanding),
    };
  });
}

export type GlobalFinancials = {
  year: number;
  // année en cours (basé sur la date d'encaissement)
  declaredHtYear: number;
  vatCollectedYear: number;
  // tous projets / tout temps
  invoicedTtc: number;
  outstanding: number;
  declaredHtAllTime: number;
};

/** KPIs financiers globaux — ADMIN uniquement. */
export async function getGlobalFinancials(year: number): Promise<GlobalFinancials> {
  const [projects, invoices, adjustments] = await Promise.all([
    db.project.findMany({
      select: { id: true, amountHt: true, vatRate: true, activity: true, payments: true },
    }),
    // Factures émises/payées : la source de vérité quand le projet n'est pas
    // chiffré (amountHt vide) ou quand la facture n'a pas de projet.
    db.document.findMany({
      where: { type: "INVOICE", status: { in: ["ISSUED", "PAID"] } },
      select: {
        projectId: true,
        status: true,
        total: true,
        subtotal: true,
        vatAmount: true,
        paidAt: true,
        activity: true,
      },
    }),
    // CA saisi à la main (activité d'avant la plateforme)
    db.revenueAdjustment.findMany(),
  ]);

  const invoicedTtcByProject = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.projectId) continue;
    invoicedTtcByProject.set(
      inv.projectId,
      (invoicedTtcByProject.get(inv.projectId) ?? 0) + Number(inv.total)
    );
  }

  let declaredHtYear = 0;
  let vatCollectedYear = 0;
  let invoicedTtc = 0;
  let outstanding = 0;
  let declaredHtAllTime = 0;
  // CA HT suivi par (année-mois-activité) : sert au « manuel prioritaire »
  // (un ajustement remplace le suivi de son mois au lieu de s'y additionner).
  const trackedByKey = new Map<string, number>();
  const trackKey = (d: Date, activity: string) =>
    `${d.getFullYear()}-${d.getMonth() + 1}-${activity}`;

  for (const p of projects) {
    const vatRate = Number(p.vatRate);
    const all = toPaymentInputs(p.payments);

    const f = computeProjectFinancials(
      p.amountHt != null ? Number(p.amountHt) : null,
      vatRate,
      all
    );
    if (p.amountHt != null) {
      invoicedTtc += f.ttc;
      // Borné ici seulement : un projet sur-encaissé ne doit pas venir
      // diminuer le « reste à encaisser » des autres.
      outstanding += Math.max(0, f.outstanding);
    } else {
      // Projet non chiffré : le montant facturé fait foi.
      const billed = invoicedTtcByProject.get(p.id) ?? 0;
      invoicedTtc += billed;
      outstanding += Math.max(0, billed - f.received);
    }
    declaredHtAllTime += f.declaredHt;

    for (const pm of p.payments) {
      const amount = Number(pm.amount);
      // Taux de la facture d'origine, sinon celui du projet.
      const rateFactor = 1 + (pm.vatRate == null ? vatRate : Number(pm.vatRate)) / 100;
      const key = trackKey(pm.paidAt, p.activity);
      trackedByKey.set(key, (trackedByKey.get(key) ?? 0) + amount / rateFactor);
      if (pm.paidAt.getFullYear() !== year) continue;
      const ht = amount / rateFactor;
      declaredHtYear += ht;
      vatCollectedYear += amount - ht;
    }
  }

  // Factures hors projet : aucun encaissement auto n'existe pour elles,
  // on les compte directement ici.
  for (const inv of invoices) {
    if (inv.projectId) continue;
    const total = Number(inv.total);
    invoicedTtc += total;
    if (inv.status === "ISSUED") {
      outstanding += total;
    } else {
      const ht = Number(inv.subtotal);
      declaredHtAllTime += ht;
      if (inv.paidAt) {
        const key = trackKey(inv.paidAt, inv.activity);
        trackedByKey.set(key, (trackedByKey.get(key) ?? 0) + ht);
      }
      if (inv.paidAt && inv.paidAt.getFullYear() === year) {
        declaredHtYear += ht;
        vatCollectedYear += Number(inv.vatAmount);
      }
    }
  }

  // CA manuel : PRIORITAIRE sur le suivi du mois (remplace, n'additionne pas).
  for (const adj of adjustments) {
    const tracked = trackedByKey.get(`${adj.year}-${adj.month}-${adj.activity}`) ?? 0;
    const delta = Number(adj.amountHt) - tracked;
    declaredHtAllTime += delta;
    if (adj.year === year) declaredHtYear += delta;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    year,
    declaredHtYear: round2(declaredHtYear),
    vatCollectedYear: round2(vatCollectedYear),
    invoicedTtc: round2(invoicedTtc),
    outstanding: round2(outstanding),
    declaredHtAllTime: round2(declaredHtAllTime),
  };
}

export type ForecastLine = {
  label: string;
  sub: string;
  amountHt: number;
  kind: "invoice" | "mrr";
};

export type MonthForecast = {
  m: number; // 1-12
  bncHt: number;
  goodsHt: number;
  lines: ForecastLine[];
};

/**
 * Prévisions mensuelles du mois en cours à décembre — ADMIN uniquement.
 *
 * Deux sources, dédoublonnées par client × mois × activité :
 * - les factures émises non payées, attendues à leur mois d'échéance
 *   (les échéances passées sont attendues sur le mois en cours) ;
 * - les revenus récurrents (MRR) : montant fixe, ou TJM × jours ouvrés du
 *   mois (mode DAILY). Dès qu'une facture est émise (ou encaissée, pour le
 *   mois en cours) pour le client sur le mois, elle FAIT FOI : le récurrent
 *   est retiré de la prévision du mois, même si les montants diffèrent.
 *
 * Pour le mois en cours, le résultat est le « reste attendu » en plus du réalisé.
 */
export async function getYearForecast(
  year: number,
  now: Date
): Promise<MonthForecast[]> {
  const currentMonth = now.getMonth() + 1;
  const monthStart = new Date(year, currentMonth - 1, 1);
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

  const [issuedInvoices, recurrings, monthPayments, monthPaidSolo] =
    await Promise.all([
      db.document.findMany({
        where: { type: "INVOICE", status: "ISSUED" },
        select: {
          number: true,
          clientId: true,
          subtotal: true,
          activity: true,
          issueDate: true,
          dueDate: true,
          client: { select: { name: true } },
        },
      }),
      db.recurringRevenue.findMany({
        include: { client: { select: { name: true } } },
      }),
      // Encaissements déclarés du mois en cours, pour le dédoublonnage MRR.
      db.payment.findMany({
        where: { paidAt: { gte: monthStart } },
        select: {
          amount: true,
          vatRate: true,
          project: { select: { clientId: true, vatRate: true, activity: true } },
        },
      }),
      db.document.findMany({
        where: {
          type: "INVOICE",
          status: "PAID",
          projectId: null,
          paidAt: { gte: monthStart },
        },
        select: { clientId: true, subtotal: true, activity: true },
      }),
    ]);

  const months: MonthForecast[] = [];
  const byMonth = new Map<number, MonthForecast>();
  for (let m = currentMonth; m <= 12; m++) {
    const entry: MonthForecast = { m, bncHt: 0, goodsHt: 0, lines: [] };
    byMonth.set(m, entry);
    months.push(entry);
  }

  const add = (entry: MonthForecast, activity: string, amountHt: number) => {
    if (activity === "GOODS") entry.goodsHt += amountHt;
    else entry.bncHt += amountHt;
  };

  // Factures émises → attendues à leur mois d'échéance (jamais avant le mois courant).
  const coveredKey = (clientId: string, m: number, activity: string) =>
    `${clientId}-${m}-${activity}`;
  const covered = new Map<string, number>();
  for (const inv of issuedInvoices) {
    const due = inv.dueDate ?? inv.issueDate ?? now;
    if (due.getFullYear() > year) continue;
    const m = Math.max(
      currentMonth,
      due.getFullYear() < year ? currentMonth : due.getMonth() + 1
    );
    const entry = byMonth.get(m);
    if (!entry) continue;
    const ht = Number(inv.subtotal);
    add(entry, inv.activity, ht);
    const key = coveredKey(inv.clientId, m, inv.activity);
    covered.set(key, (covered.get(key) ?? 0) + ht);
    entry.lines.push({
      label: `Facture ${inv.number ?? ""} · ${inv.client.name}`,
      sub: `émise, échéance ${dayFmt.format(due)}`,
      amountHt: ht,
      kind: "invoice",
    });
  }

  // Réalisé du mois en cours par client × activité : un MRR déjà encaissé
  // ce mois-ci ne doit pas rester en « attendu ».
  for (const p of monthPayments) {
    const rate = p.vatRate == null ? Number(p.project.vatRate) : Number(p.vatRate);
    const ht = Number(p.amount) / (1 + rate / 100);
    const key = coveredKey(p.project.clientId, currentMonth, p.project.activity);
    covered.set(key, (covered.get(key) ?? 0) + ht);
  }
  for (const inv of monthPaidSolo) {
    const key = coveredKey(inv.clientId, currentMonth, inv.activity);
    covered.set(key, (covered.get(key) ?? 0) + Number(inv.subtotal));
  }

  // MRR par client × mois × activité. Une facture émise/encaissée du client
  // sur le mois fait foi : le récurrent est retiré (montants souvent
  // différents — ex. régie au TJM dont le nombre de jours réel varie).
  // Dates au 1er du mois stockées en UTC (colonne DATE) : comparaison en UTC.
  const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  for (const rec of recurrings) {
    const amount = Number(rec.amountHt);
    const from = monthIndex(rec.startsOn);
    const to = rec.endsOn ? monthIndex(rec.endsOn) : Infinity;
    for (let m = currentMonth; m <= 12; m++) {
      const idx = year * 12 + (m - 1);
      if (idx < from || idx > to) continue;
      const already = covered.get(coveredKey(rec.clientId, m, rec.activity)) ?? 0;
      if (already > 0) continue;
      const entry = byMonth.get(m)!;
      const days = rec.mode === "DAILY" ? workingDaysInMonth(year, m) : null;
      const expected = days != null ? amount * days : amount;
      add(entry, rec.activity, expected);
      entry.lines.push({
        label: `${rec.client.name} · ${rec.label}`,
        sub:
          days != null
            ? `récurrent — ${days} j ouvrés × ${formatEUR(amount)}`
            : "récurrent mensuel",
        amountHt: expected,
        kind: "mrr",
      });
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (const entry of months) {
    entry.bncHt = round2(entry.bncHt);
    entry.goodsHt = round2(entry.goodsHt);
    entry.lines = entry.lines.map((l) => ({ ...l, amountHt: round2(l.amountHt) }));
  }
  return months;
}

export type MrrSummary = {
  totalHt: number; // attendu sur le mois (fixe + TJM × jours ouvrés)
  count: number; // nombre de récurrents actifs
  days: number; // jours ouvrés du mois
};

/** MRR attendu sur le mois de `now` — ADMIN uniquement. */
export async function getMonthlyMrr(now: Date): Promise<MrrSummary> {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const recurrings = await db.recurringRevenue.findMany();

  const idx = year * 12 + (month - 1);
  const monthIdx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const days = workingDaysInMonth(year, month);

  let totalHt = 0;
  let count = 0;
  for (const rec of recurrings) {
    const from = monthIdx(rec.startsOn);
    const to = rec.endsOn ? monthIdx(rec.endsOn) : Infinity;
    if (idx < from || idx > to) continue;
    count++;
    totalHt +=
      rec.mode === "DAILY" ? Number(rec.amountHt) * days : Number(rec.amountHt);
  }
  return { totalHt: Math.round(totalHt * 100) / 100, count, days };
}

export type RecurringBillingItem = {
  recurringId: string;
  clientId: string;
  clientName: string;
  label: string;
  mode: "FIXED" | "DAILY";
  unitHt: number; // fixe : montant mensuel ; DAILY : TJM
  days: number; // jours ouvrés du mois
  expectedHt: number; // montant attendu ce mois
  activity: "SERVICE_BNC" | "GOODS";
  status: "todo" | "draft" | "done";
  draftId: string | null; // brouillon du mois à finaliser, le cas échéant
};

/**
 * État de facturation des récurrents pour le mois de `now` — ADMIN uniquement.
 * done : une facture émise/payée (ou un encaissement déclaré) couvre le client
 * sur le mois ; draft : un brouillon de facture du mois existe pour le client.
 */
export async function getRecurringBillingStatus(
  now: Date
): Promise<RecurringBillingItem[]> {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [recurrings, invoices, payments] = await Promise.all([
    db.recurringRevenue.findMany({
      include: { client: { select: { name: true } } },
      orderBy: { client: { name: "asc" } },
    }),
    db.document.findMany({
      where: {
        type: "INVOICE",
        OR: [
          {
            status: { in: ["ISSUED", "PAID"] },
            issueDate: { gte: monthStart, lt: monthEnd },
          },
          { status: "DRAFT", createdAt: { gte: monthStart, lt: monthEnd } },
        ],
      },
      select: { id: true, clientId: true, status: true, activity: true },
    }),
    db.payment.findMany({
      where: { paidAt: { gte: monthStart, lt: monthEnd } },
      select: { project: { select: { clientId: true, activity: true } } },
    }),
  ]);

  const doneKeys = new Set<string>();
  const draftByKey = new Map<string, string>();
  const key = (clientId: string, activity: string) => `${clientId}-${activity}`;
  for (const inv of invoices) {
    if (inv.status === "DRAFT") {
      if (!draftByKey.has(key(inv.clientId, inv.activity))) {
        draftByKey.set(key(inv.clientId, inv.activity), inv.id);
      }
    } else {
      doneKeys.add(key(inv.clientId, inv.activity));
    }
  }
  for (const p of payments) {
    doneKeys.add(key(p.project.clientId, p.project.activity));
  }

  const idx = year * 12 + (month - 1);
  const monthIdx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const days = workingDaysInMonth(year, month);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return recurrings
    .filter((rec) => {
      const from = monthIdx(rec.startsOn);
      const to = rec.endsOn ? monthIdx(rec.endsOn) : Infinity;
      return idx >= from && idx <= to;
    })
    .map((rec) => {
      const unitHt = Number(rec.amountHt);
      const k = key(rec.clientId, rec.activity);
      return {
        recurringId: rec.id,
        clientId: rec.clientId,
        clientName: rec.client.name,
        label: rec.label,
        mode: rec.mode,
        unitHt,
        days,
        expectedHt: round2(rec.mode === "DAILY" ? unitHt * days : unitHt),
        activity: rec.activity,
        status: doneKeys.has(k) ? "done" : draftByKey.has(k) ? "draft" : "todo",
        draftId: doneKeys.has(k) ? null : (draftByKey.get(k) ?? null),
      };
    });
}

export type FinancePoint = {
  month: string; // "MM/YY"
  declaredHt: number; // CA HT déclaré compté (BNC + ventes, manuel prioritaire)
  bncHt: number; // BNC compté (manuel du mois s'il existe, sinon suivi)
  goodsHt: number; // ventes comptées (idem)
  bncTracked: number; // BNC suivi automatiquement (paiements + factures)
  goodsTracked: number; // ventes suivies automatiquement
  vatCollected: number; // TVA encaissée sur le CA déclaré du mois
  received: number; // total encaissé du mois (TTC)
  cumulativeHt: number; // CA HT déclaré cumulé sur la période
};

/**
 * Séries mensuelles d'encaissements sur les N derniers mois — ADMIN uniquement.
 * Le CA HT est reconstruit à partir du taux de TVA du projet de chaque paiement.
 */
export async function getFinanceTimeseries(
  months: number,
  now: Date
): Promise<FinancePoint[]> {
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [payments, standaloneInvoices, adjustments] = await Promise.all([
    db.payment.findMany({
      where: { paidAt: { gte: start } },
      select: {
        amount: true,
        vatRate: true,
        paidAt: true,
        project: { select: { vatRate: true, activity: true } },
      },
    }),
    // Factures payées sans projet : pas d'encaissement auto, on les intègre ici.
    db.document.findMany({
      where: {
        type: "INVOICE",
        status: "PAID",
        projectId: null,
        paidAt: { gte: start },
      },
      select: { total: true, subtotal: true, paidAt: true, activity: true },
    }),
    // CA saisi à la main (activité d'avant la plateforme)
    db.revenueAdjustment.findMany(),
  ]);

  const key = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;

  const buckets = new Map<
    string,
    { bncHt: number; goodsHt: number; vat: number; received: number }
  >();
  const order: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const k = key(d);
    order.push(k);
    buckets.set(k, { bncHt: 0, goodsHt: 0, vat: 0, received: 0 });
  }

  const addDeclared = (
    b: { bncHt: number; goodsHt: number },
    amountHt: number,
    activity: string
  ) => {
    if (activity === "GOODS") b.goodsHt += amountHt;
    else b.bncHt += amountHt;
  };

  for (const p of payments) {
    const k = key(p.paidAt);
    const b = buckets.get(k);
    if (!b) continue;
    const amount = Number(p.amount);
    b.received += amount;
    // Taux de la facture d'origine, sinon celui du projet.
    const rate = p.vatRate == null ? Number(p.project.vatRate) : Number(p.vatRate);
    const ht = amount / (1 + rate / 100);
    addDeclared(b, ht, p.project.activity);
    b.vat += amount - ht;
  }

  for (const inv of standaloneInvoices) {
    if (!inv.paidAt) continue;
    const b = buckets.get(key(inv.paidAt));
    if (!b) continue;
    b.received += Number(inv.total);
    addDeclared(b, Number(inv.subtotal), inv.activity);
    b.vat += Number(inv.total) - Number(inv.subtotal);
  }

  // CA manuel : PRIORITAIRE — remplace le suivi du mois pour son activité.
  const overrides = new Map<string, { bnc?: number; goods?: number }>();
  for (const adj of adjustments) {
    const k = `${String(adj.month).padStart(2, "0")}/${String(adj.year).slice(2)}`;
    const o = overrides.get(k) ?? {};
    if (adj.activity === "GOODS") o.goods = Number(adj.amountHt);
    else o.bnc = Number(adj.amountHt);
    overrides.set(k, o);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  let cumulative = 0;
  return order.map((k) => {
    const b = buckets.get(k)!;
    const o = overrides.get(k);
    const bncEff = o?.bnc ?? b.bncHt;
    const goodsEff = o?.goods ?? b.goodsHt;
    const declaredHt = bncEff + goodsEff;
    cumulative += declaredHt;
    // L'encaissé réel ne diminue jamais ; un manuel plus haut que le suivi
    // ajoute la différence (mois d'avant la plateforme).
    const received =
      b.received +
      Math.max(0, bncEff - b.bncHt) +
      Math.max(0, goodsEff - b.goodsHt);
    return {
      month: k,
      declaredHt: round2(declaredHt),
      bncHt: round2(bncEff),
      goodsHt: round2(goodsEff),
      bncTracked: round2(b.bncHt),
      goodsTracked: round2(b.goodsHt),
      // La TVA suit les encaissements réels : le CA manuel (HT) ne la modifie pas.
      vatCollected: round2(b.vat),
      received: round2(received),
      cumulativeHt: round2(cumulative),
    };
  });
}
