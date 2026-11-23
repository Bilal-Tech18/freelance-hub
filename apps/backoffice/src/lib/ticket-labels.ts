import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";

export const TYPE_LABELS: Record<TicketType, string> = {
  BUG: "Bug",
  DESIGN_FEEDBACK: "Retour design",
  EVOLUTION: "Évolution",
  QUESTION: "Question",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  IN_DEV: "In dev",
  WAITING_ON_CLIENT: "En attente client",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

export const STATUS_ORDER: TicketStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "IN_DEV",
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

/**
 * IN_DEV est un statut interne (suivi "ça marche en dev") : le client ne doit
 * jamais le voir. Côté portail / API client, il est présenté comme IN_PROGRESS.
 */
export function maskStatusForClient(status: TicketStatus): TicketStatus {
  return status === "IN_DEV" ? "IN_PROGRESS" : status;
}

/** Statuts exposés au client (filtres du portail). */
export const CLIENT_STATUS_LABELS: Partial<Record<TicketStatus, string>> =
  Object.fromEntries(
    Object.entries(STATUS_LABELS).filter(([s]) => s !== "IN_DEV")
  );
