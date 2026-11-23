import type { TicketPriority, TicketStatus } from "@prisma/client";

/** Délai de correction cible, en jours ouvrés, par priorité. */
export const SLA_BUSINESS_DAYS: Record<TicketPriority, number> = {
  URGENT: 2,
  HIGH: 5,
  MEDIUM: 10,
  LOW: 20,
};

/** Ajoute n jours ouvrés (samedi/dimanche exclus) à une date. */
export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

export function computeDueDate(priority: TicketPriority, from = new Date()): Date {
  return addBusinessDays(from, SLA_BUSINESS_DAYS[priority]);
}

/**
 * Statuts où le retard ne s'applique pas : la balle n'est plus côté dev
 * (en attente du client, résolu ou fermé).
 */
export const OVERDUE_EXEMPT_STATUSES: TicketStatus[] = [
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

export function isOverdue(ticket: {
  status: TicketStatus;
  dueDate: Date | null;
}): boolean {
  if (!ticket.dueDate) return false;
  if (OVERDUE_EXEMPT_STATUSES.includes(ticket.status)) return false;
  return new Date() > ticket.dueDate;
}

/**
 * Le client teste les tickets résolus : il peut les VALIDER (→ CLOSED) ou les
 * ROUVRIR (→ IN_PROGRESS). Il peut aussi rouvrir un ticket qu'il avait validé.
 */
const CLIENT_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: [],
  IN_PROGRESS: [],
  IN_DEV: [],
  WAITING_ON_CLIENT: [],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"],
};

export function canTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: string
): boolean {
  if (from === to) return false;
  // L'équipe (admin, mainteneur) gère librement le cycle de vie
  // (réouverture depuis RESOLVED/CLOSED incluse).
  if (role === "ADMIN" || role === "MAINTAINER") return true;
  return CLIENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Champs à mettre à jour lors d'un changement de statut. */
export function statusChangeFields(to: TicketStatus): {
  resolvedAt?: Date | null;
  closedAt?: Date | null;
} {
  switch (to) {
    case "RESOLVED":
      return { resolvedAt: new Date(), closedAt: null };
    case "CLOSED":
      return { closedAt: new Date() };
    default:
      // Réouverture : on efface les dates de résolution/clôture
      return { resolvedAt: null, closedAt: null };
  }
}
