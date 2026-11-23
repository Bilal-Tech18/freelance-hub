import "server-only";

import { db } from "@/lib/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

type ClientWithData = {
  id: string;
  name: string;
  referralDate: Date | null;
  commissionRate: unknown;
  referralDurationMonths: number;
  projects: {
    vatRate: unknown;
    payments: { amount: unknown; paidAt: Date }[];
  }[];
};

export type ClientCommission = {
  clientId: string;
  clientName: string;
  windowStart: Date | null;
  windowEnd: Date | null;
  active: boolean;
  rate: number;
  htInWindow: number; // CA HT du client dans la fenêtre
  commission: number; // dû à l'apporteur
};

/** Commission due sur un client apporté, sur sa fenêtre d'un an. */
export function computeClientCommission(
  client: ClientWithData,
  defaultRate: number,
  now: Date
): ClientCommission {
  const rate = client.commissionRate != null ? Number(client.commissionRate) : defaultRate;
  const base = {
    clientId: client.id,
    clientName: client.name,
    rate,
  };

  if (!client.referralDate) {
    return {
      ...base,
      windowStart: null,
      windowEnd: null,
      active: false,
      htInWindow: 0,
      commission: 0,
    };
  }

  const windowStart = client.referralDate;
  const windowEnd = addMonths(windowStart, client.referralDurationMonths);
  const active = now <= windowEnd;

  // Commission sur tout l'encaissé, converti en HT.
  let htInWindow = 0;
  for (const project of client.projects) {
    const rateFactor = 1 + Number(project.vatRate) / 100;
    for (const p of project.payments) {
      if (p.paidAt < windowStart || p.paidAt > windowEnd) continue;
      htInWindow += Number(p.amount) / rateFactor;
    }
  }
  htInWindow = round2(htInWindow);
  const commission = round2((htInWindow * rate) / 100);

  return { ...base, windowStart, windowEnd, active, htInWindow, commission };
}

const clientInclude = {
  projects: {
    select: {
      vatRate: true,
      payments: { select: { amount: true, paidAt: true } },
    },
  },
} as const;

export async function getReferrerDetail(id: string, now: Date) {
  const referrer = await db.referrer.findUnique({
    where: { id },
    include: {
      clients: { include: clientInclude },
      payouts: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!referrer) return null;

  const defaultRate = Number(referrer.defaultCommissionRate);
  const commissions = referrer.clients.map((c) =>
    computeClientCommission(c as ClientWithData, defaultRate, now)
  );
  const totalDue = round2(commissions.reduce((s, c) => s + c.commission, 0));
  const activeDue = round2(
    commissions.filter((c) => c.active).reduce((s, c) => s + c.commission, 0)
  );
  const totalPaid = round2(
    referrer.payouts.reduce((s, p) => s + Number(p.amount), 0)
  );
  const remaining = round2(totalDue - totalPaid);

  return { referrer, commissions, totalDue, activeDue, totalPaid, remaining };
}

export async function listReferrers(now: Date) {
  const referrers = await db.referrer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      clients: { include: clientInclude },
      payouts: { select: { amount: true } },
    },
  });
  return referrers.map((r) => {
    const defaultRate = Number(r.defaultCommissionRate);
    const commissions = r.clients.map((c) =>
      computeClientCommission(c as ClientWithData, defaultRate, now)
    );
    const totalDue = round2(commissions.reduce((s, c) => s + c.commission, 0));
    const totalPaid = round2(r.payouts.reduce((s, p) => s + Number(p.amount), 0));
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      clientCount: r.clients.length,
      activeCount: commissions.filter((c) => c.active).length,
      totalDue,
      totalPaid,
      remaining: round2(totalDue - totalPaid),
    };
  });
}

/** Reste à régler aux apporteurs (commissions dues − règlements), pour le dashboard. */
export async function getTotalCommissionsDue(now: Date): Promise<number> {
  const referrers = await db.referrer.findMany({
    include: {
      clients: { include: clientInclude },
      payouts: { select: { amount: true } },
    },
  });
  let total = 0;
  for (const r of referrers) {
    const defaultRate = Number(r.defaultCommissionRate);
    for (const c of r.clients) {
      total += computeClientCommission(c as ClientWithData, defaultRate, now).commission;
    }
    for (const p of r.payouts) {
      total -= Number(p.amount);
    }
  }
  return round2(total);
}
