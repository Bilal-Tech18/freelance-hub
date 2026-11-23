import "server-only";

import { db } from "@/lib/db";
import { formatEUR } from "@/lib/finance";
import { sendOverdueInvoicesEmail } from "@/lib/emails";

const DAY_MS = 24 * 60 * 60 * 1000;
// Nouvelle relance interne au plus tous les 7 jours tant que ça reste impayé.
const REMIND_EVERY_MS = 7 * DAY_MS;

/** Factures émises dont l'échéance est dépassée — ADMIN uniquement. */
export async function getOverdueInvoices(now = new Date()) {
  return db.document.findMany({
    where: { type: "INVOICE", status: "ISSUED", dueDate: { lt: now } },
    include: { client: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
}

/**
 * Relance INTERNE des factures en retard : email à l'admin uniquement, le
 * client n'est jamais contacté (les relances client restent manuelles).
 * Un email part quand une facture devient en retard, puis au plus une fois
 * par semaine tant qu'elle reste impayée.
 */
export async function remindOverdueInvoices(now = new Date()) {
  const overdue = await getOverdueInvoices(now);
  if (overdue.length === 0) return { overdue: 0, sent: false };

  const needsReminder = overdue.some(
    (d) =>
      !d.overdueNotifiedAt ||
      now.getTime() - d.overdueNotifiedAt.getTime() > REMIND_EVERY_MS
  );
  if (!needsReminder) return { overdue: overdue.length, sent: false };

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  });
  await sendOverdueInvoicesEmail({
    invoices: overdue.map((d) => ({
      number: d.number ?? "(sans numéro)",
      clientName: d.client.name,
      total: formatEUR(Number(d.total)),
      dueDate: d.dueDate ? dateFmt.format(d.dueDate) : "—",
      daysLate: d.dueDate
        ? Math.floor((now.getTime() - d.dueDate.getTime()) / DAY_MS)
        : 0,
    })),
  });
  // L'email récapitule tout : on repart de zéro pour toutes les factures listées.
  await db.document.updateMany({
    where: { id: { in: overdue.map((d) => d.id) } },
    data: { overdueNotifiedAt: now },
  });
  return { overdue: overdue.length, sent: true };
}
