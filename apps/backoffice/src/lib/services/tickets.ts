import "server-only";

import type { Prisma, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { db } from "@/lib/db";
import { canTransition, computeDueDate, statusChangeFields } from "@/lib/sla";
import {
  sendNewTicketEmail,
  // sendTicketResolvedEmail, // emails de changement de statut désactivés
  sendTicketUpdateEmail,
} from "@/lib/emails";
// STATUS_LABELS : utilisé uniquement par les emails de changement de statut (désactivés)
import { maskStatusForClient } from "@/lib/ticket-labels";

/**
 * Couche service partagée par les server actions (UI) et l'API publique /api/v1.
 * L'acteur est toujours explicite : le scoping et les règles de transition
 * dépendent de son rôle.
 */
export type Actor = {
  id: string;
  name: string;
  role: string; // "ADMIN" | "CLIENT"
  clientId: string | null;
};

export class TicketError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID",
    message: string
  ) {
    super(message);
  }
}

/** Équipe interne : admin + mainteneur (le mainteneur sur son périmètre). */
function isStaff(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "MAINTAINER";
}

function scopedTicketWhere(actor: Actor): Prisma.TicketWhereInput {
  if (actor.role === "ADMIN") return {};
  // Le mainteneur voit tous les tickets (internes inclus) de ses projets assignés.
  if (actor.role === "MAINTAINER") {
    return { project: { assignments: { some: { userId: actor.id } } } };
  }
  // Les tickets internes n'existent pas côté client (liste, détail, commentaires, API).
  return { project: { clientId: actor.clientId ?? "__none__" }, internal: false };
}

/**
 * IN_DEV est un statut purement interne : côté client il est présenté comme
 * IN_PROGRESS (affichage, filtres et API confondus).
 */
function maskTicketForClient<T extends { status: TicketStatus }>(
  actor: Actor,
  ticket: T
): T {
  if (isStaff(actor) || ticket.status !== "IN_DEV") return ticket;
  return { ...ticket, status: "IN_PROGRESS" as TicketStatus };
}

function statusFilterFor(
  actor: Actor,
  status: TicketStatus
): Prisma.TicketWhereInput {
  if (isStaff(actor)) return { status };
  // Pour le client, IN_PROGRESS englobe IN_DEV (et IN_DEV seul n'existe pas).
  if (status === "IN_PROGRESS" || status === "IN_DEV") {
    return { status: { in: ["IN_PROGRESS", "IN_DEV"] } };
  }
  return { status };
}

export type AttachmentInput = {
  url: string;
  publicId: string;
  filename: string;
  contentType: string;
  size: number;
};

const MAX_ATTACHMENTS = 5;

function validateAttachments(attachments: AttachmentInput[]) {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new TicketError("INVALID", `Maximum ${MAX_ATTACHMENTS} pièces jointes.`);
  }
}

export async function createTicket(
  actor: Actor,
  input: {
    projectId: string;
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    internal?: boolean;
    attachments?: AttachmentInput[];
  }
) {
  if (input.internal && !isStaff(actor)) {
    throw new TicketError("FORBIDDEN", "Tickets internes réservés à l'équipe.");
  }
  const project = await db.project.findFirst({
    where: {
      id: input.projectId,
      ...(actor.role === "ADMIN"
        ? {}
        : actor.role === "MAINTAINER"
          ? { assignments: { some: { userId: actor.id } } }
          : { clientId: actor.clientId ?? "__none__" }),
    },
    include: { client: true },
  });
  if (!project) throw new TicketError("NOT_FOUND", "Projet introuvable.");

  const attachments = input.attachments ?? [];
  validateAttachments(attachments);

  const ticket = await db.ticket.create({
    data: {
      projectId: project.id,
      createdById: actor.id,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      internal: input.internal ?? false,
      dueDate: computeDueDate(input.priority),
      attachments: {
        create: attachments.map((a) => ({ ...a, uploadedById: actor.id })),
      },
    },
    include: {
      project: { include: { client: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Nouveau ticket → notifier l'admin (sauf si l'admin l'a créé lui-même)
  if (actor.role !== "ADMIN") {
    const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      await sendNewTicketEmail({
        to: admin.email,
        ticketNumber: ticket.number,
        title: ticket.title,
        projectName: project.name,
        clientName: project.client.name,
        authorName: actor.name,
        priority: ticket.priority,
      });
    }
  }

  return ticket;
}

export async function getTicket(actor: Actor, ticketId: string) {
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...scopedTicketWhere(actor) },
    include: {
      project: { include: { client: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
      attachments: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: true,
        },
      },
      statusChanges: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { id: true, name: true, role: true } } },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        include: { editedBy: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!ticket) throw new TicketError("NOT_FOUND", "Ticket introuvable.");

  // L'historique des modifications est réservé à l'équipe.
  if (!isStaff(actor)) ticket.revisions = [];

  // Côté client, IN_DEV est présenté comme IN_PROGRESS dans l'historique aussi ;
  // les transitions devenues des no-ops après masquage sont retirées.
  if (!isStaff(actor)) {
    ticket.statusChanges = ticket.statusChanges
      .map((c) => ({
        ...c,
        fromStatus: maskStatusForClient(c.fromStatus),
        toStatus: maskStatusForClient(c.toStatus),
      }))
      .filter((c) => c.fromStatus !== c.toStatus);
  }

  return maskTicketForClient(actor, ticket);
}

export type TicketFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  projectId?: string;
  clientId?: string;
  overdue?: boolean;
  /** Masque les tickets fermés (ignoré si un statut explicite est demandé). */
  excludeClosed?: boolean;
  sort?: "createdAt" | "dueDate" | "priority" | "updatedAt";
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
};

const PRIORITY_ORDER: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export async function listTickets(actor: Actor, filters: TicketFilters = {}) {
  const where: Prisma.TicketWhereInput = {
    ...scopedTicketWhere(actor),
    ...(filters.status
      ? statusFilterFor(actor, filters.status)
      : filters.excludeClosed
        ? { status: { not: "CLOSED" as TicketStatus } }
        : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.clientId ? { project: { clientId: filters.clientId } } : {}),
    ...(filters.overdue
      ? {
          dueDate: { lt: new Date() },
          status: { notIn: ["WAITING_ON_CLIENT", "RESOLVED", "CLOSED"] },
        }
      : {}),
  };

  const limit = Math.min(filters.limit ?? 50, 100);
  const sort = filters.sort ?? "createdAt";
  const order = filters.order ?? "desc";

  const tickets = await db.ticket.findMany({
    where,
    include: {
      project: { include: { client: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy:
      sort === "priority"
        ? [{ priority: order }, { createdAt: "desc" }]
        : [{ [sort]: order }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = tickets.length > limit;
  const page = hasMore ? tickets.slice(0, limit) : tickets;

  if (sort === "priority") {
    page.sort((a, b) => {
      const diff =
        PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      return order === "asc" ? -diff : diff;
    });
  }

  return {
    tickets: page.map((t) => maskTicketForClient(actor, t)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function updateTicket(
  actor: Actor,
  ticketId: string,
  input: {
    status?: TicketStatus;
    priority?: TicketPriority;
    dueDate?: Date | null;
    title?: string;
  }
) {
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...scopedTicketWhere(actor) },
    include: { project: { include: { client: true } }, createdBy: true },
  });
  if (!ticket) throw new TicketError("NOT_FOUND", "Ticket introuvable.");

  // Seule l'équipe modifie priorité / deadline / titre
  if (
    !isStaff(actor) &&
    (input.priority !== undefined ||
      input.dueDate !== undefined ||
      input.title !== undefined)
  ) {
    throw new TicketError("FORBIDDEN", "Modification réservée à l'équipe.");
  }

  const data: Prisma.TicketUpdateInput = {};

  if (input.status && input.status !== ticket.status) {
    if (!canTransition(ticket.status, input.status, actor.role)) {
      throw new TicketError(
        "INVALID",
        `Transition ${ticket.status} → ${input.status} non autorisée.`
      );
    }
    data.status = input.status;
    Object.assign(data, statusChangeFields(input.status));
  }
  if (input.priority) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.title) data.title = input.title;

  if (Object.keys(data).length === 0) return ticket;

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data,
    include: { project: { include: { client: true } }, createdBy: true },
  });

  // Trace du changement de statut (historique affiché sur la fiche)
  if (input.status && data.status) {
    await db.ticketStatusChange.create({
      data: {
        ticketId: ticket.id,
        fromStatus: ticket.status,
        toStatus: input.status,
        changedById: actor.id,
      },
    });
  }

  // Emails sur changement de statut désactivés (voir git blame pour réactiver).
  // // Changement de statut par l'admin → notifier le créateur du ticket
  // // (sauf IN_DEV : statut interne, invisible pour le client ; et sauf
  // // ticket interne : jamais aucune notification)
  // if (
  //   data.status &&
  //   data.status !== "IN_DEV" &&
  //   !ticket.internal &&
  //   actor.role === "ADMIN" &&
  //   ticket.createdBy.id !== actor.id
  // ) {
  //   if (data.status === "RESOLVED") {
  //     await sendTicketResolvedEmail({
  //       to: ticket.createdBy.email,
  //       ticketNumber: updated.number,
  //       title: updated.title,
  //       ticketId: updated.id,
  //     });
  //   } else {
  //     await sendTicketUpdateEmail({
  //       to: ticket.createdBy.email,
  //       ticketNumber: updated.number,
  //       title: updated.title,
  //       event: `Statut mis à jour : ${STATUS_LABELS[data.status as TicketStatus]}`,
  //       path: `/tickets/${updated.id}`,
  //     });
  //   }
  // }

  // // Validation ou réouverture par le client → notifier l'admin
  // if (data.status && actor.role !== "ADMIN") {
  //   const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  //   if (admin && admin.id !== actor.id) {
  //     await sendTicketUpdateEmail({
  //       to: admin.email,
  //       ticketNumber: updated.number,
  //       title: updated.title,
  //       event:
  //         data.status === "CLOSED"
  //           ? `Ticket validé par ${actor.name}`
  //           : `Ticket rouvert par ${actor.name}`,
  //       path: `/admin/tickets/${updated.id}`,
  //     });
  //   }
  // }

  return updated;
}

/**
 * Modification du contenu d'un ticket (titre, description, type, priorité).
 * Le client ne peut modifier que ses propres tickets tant qu'ils sont NEW ;
 * l'admin peut modifier n'importe quel ticket. Chaque modification enregistre
 * une révision (snapshot des valeurs précédentes), visible uniquement par l'admin.
 */
export async function editTicket(
  actor: Actor,
  ticketId: string,
  input: {
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
  }
) {
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...scopedTicketWhere(actor) },
    include: { project: { include: { client: true } }, createdBy: true },
  });
  if (!ticket) throw new TicketError("NOT_FOUND", "Ticket introuvable.");

  if (!isStaff(actor)) {
    if (ticket.createdById !== actor.id) {
      throw new TicketError(
        "FORBIDDEN",
        "Seul l'auteur du ticket peut le modifier."
      );
    }
    if (ticket.status !== "NEW") {
      throw new TicketError(
        "INVALID",
        "Un ticket n'est modifiable que tant qu'il a le statut « Nouveau »."
      );
    }
  }

  const changed =
    input.title !== ticket.title ||
    input.description !== ticket.description ||
    input.type !== ticket.type ||
    input.priority !== ticket.priority;
  if (!changed) return ticket;

  const [updated] = await db.$transaction([
    db.ticket.update({
      where: { id: ticket.id },
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        // Une priorité modifiée recalcule la deadline SLA.
        ...(input.priority !== ticket.priority
          ? { dueDate: computeDueDate(input.priority) }
          : {}),
      },
      include: { project: { include: { client: true } }, createdBy: true },
    }),
    db.ticketRevision.create({
      data: {
        ticketId: ticket.id,
        editedById: actor.id,
        previousTitle: ticket.title,
        previousDescription: ticket.description,
        previousType: ticket.type,
        previousPriority: ticket.priority,
      },
    }),
  ]);

  // Modification par le client → notifier l'admin (jamais sur un ticket interne)
  if (actor.role !== "ADMIN" && !ticket.internal) {
    const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
    if (admin && admin.id !== actor.id) {
      await sendTicketUpdateEmail({
        to: admin.email,
        ticketNumber: updated.number,
        title: updated.title,
        event: `Ticket modifié par ${actor.name}`,
        path: `/admin/tickets/${updated.id}`,
      });
    }
  }

  return updated;
}

export async function addComment(
  actor: Actor,
  ticketId: string,
  input: { body: string; attachments?: AttachmentInput[] }
) {
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...scopedTicketWhere(actor) },
    include: { project: { include: { client: true } }, createdBy: true },
  });
  if (!ticket) throw new TicketError("NOT_FOUND", "Ticket introuvable.");
  if (!input.body.trim()) throw new TicketError("INVALID", "Commentaire vide.");

  const attachments = input.attachments ?? [];
  validateAttachments(attachments);

  const comment = await db.comment.create({
    data: {
      ticketId: ticket.id,
      authorId: actor.id,
      body: input.body,
      attachments: {
        create: attachments.map((a) => ({
          ...a,
          uploadedById: actor.id,
          ticketId: null,
        })),
      },
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  // Notification croisée : équipe commente → client ; client commente → admin
  // (jamais de notification sur un ticket interne)
  if (isStaff(actor)) {
    if (!ticket.internal && ticket.createdBy.id !== actor.id) {
      await sendTicketUpdateEmail({
        to: ticket.createdBy.email,
        ticketNumber: ticket.number,
        title: ticket.title,
        event: "Nouvelle réponse sur votre ticket",
      });
    }
  } else {
    const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      await sendTicketUpdateEmail({
        to: admin.email,
        ticketNumber: ticket.number,
        title: ticket.title,
        event: `Nouveau commentaire de ${actor.name}`,
      });
    }
  }

  return comment;
}
