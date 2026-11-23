"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, requireStaff, isStaffRole } from "@/lib/authz";
import {
  addComment,
  createTicket,
  editTicket,
  updateTicket,
  TicketError,
} from "@/lib/services/tickets";

export type ActionState = { error?: string } | undefined;

const attachmentSchema = z.object({
  url: z.string().url().refine(
    (u) => u.startsWith("https://res.cloudinary.com/"),
    "URL de fichier invalide"
  ),
  publicId: z.string().min(1).max(300),
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});

function parseAttachments(raw: FormDataEntryValue | null) {
  if (!raw) return [];
  const parsed = z.array(attachmentSchema).max(5).safeParse(JSON.parse(String(raw)));
  if (!parsed.success) throw new TicketError("INVALID", "Pièces jointes invalides.");
  return parsed.data;
}

const createSchema = z.object({
  projectId: z.string().min(1, "Choisissez un projet"),
  title: z.string().min(3, "Titre trop court").max(200),
  description: z.string().min(10, "Décrivez le problème (10 caractères min.)").max(10000),
  type: z.enum(["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  internal: z.boolean(),
});

export async function createTicketAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    // Réservé à l'équipe (le service le vérifie aussi côté serveur).
    internal: isStaffRole(user.role) && formData.get("internal") === "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let ticket;
  try {
    ticket = await createTicket(user, {
      ...parsed.data,
      attachments: parseAttachments(formData.get("attachments")),
    });
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    if (e instanceof SyntaxError) return { error: "Pièces jointes invalides." };
    throw e;
  }
  redirect(
    user.role === "ADMIN"
      ? `/admin/tickets/${ticket.id}`
      : user.role === "MAINTAINER"
        ? `/maintenance/tickets/${ticket.id}`
        : `/tickets/${ticket.id}`
  );
}

const editSchema = z.object({
  ticketId: z.string().min(1),
  title: z.string().min(3, "Titre trop court").max(200),
  description: z.string().min(10, "Décrivez le problème (10 caractères min.)").max(10000),
  type: z.enum(["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});

export type EditActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Modification d'un ticket par son auteur (tant qu'il est « Nouveau »)
 * ou par l'admin. `ok: true` signale le succès au dialogue d'édition.
 */
export async function editTicketAction(
  _prev: EditActionState,
  formData: FormData
): Promise<EditActionState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    ticketId: formData.get("ticketId"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { ticketId, ...input } = parsed.data;
  try {
    await editTicket(user, ticketId, input);
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath(`/maintenance/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/admin/tickets");
  revalidatePath("/maintenance/tickets");
  return { ok: true };
}

const commentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Commentaire vide").max(10000),
});

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await addComment(user, parsed.data.ticketId, {
      body: parsed.data.body,
      attachments: parseAttachments(formData.get("attachments")),
    });
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    if (e instanceof SyntaxError) return { error: "Pièces jointes invalides." };
    throw e;
  }
  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  revalidatePath(`/maintenance/tickets/${parsed.data.ticketId}`);
  return undefined;
}

const updateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional(),
});

/** Contrôles équipe (admin / mainteneur) : statut / priorité / deadline. */
export async function updateTicketAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff();
  const parsed = updateSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { ticketId, status, priority, dueDate } = parsed.data;
  try {
    await updateTicket(admin, ticketId, {
      status,
      priority,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
    });
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/maintenance/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  revalidatePath("/maintenance/tickets");
  return undefined;
}

const bulkStatusSchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"]),
});

/** Changement de statut en lot depuis la liste admin / maintenance. */
export async function bulkUpdateTicketStatusAction(input: {
  ticketIds: string[];
  status: string;
}): Promise<{ updated: number; error?: string }> {
  const admin = await requireStaff();
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return { updated: 0, error: "Requête invalide." };

  let updated = 0;
  const errors: string[] = [];
  for (const ticketId of parsed.data.ticketIds) {
    try {
      await updateTicket(admin, ticketId, { status: parsed.data.status });
      updated++;
    } catch (e) {
      if (e instanceof TicketError) errors.push(e.message);
      else throw e;
    }
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/tickets");
  revalidatePath("/maintenance/tickets");
  return {
    updated,
    ...(errors.length
      ? { error: `${errors.length} ticket(s) non mis à jour — ${errors[0]}` }
      : {}),
  };
}

/** Le client rouvre un ticket résolu. */
/** Changement de statut par le client : valider ou rouvrir (transitions validées côté service). */
export async function clientMoveTicketAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["NEW", "IN_PROGRESS", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"];
  if (!ticketId || !allowed.includes(status)) return { error: "Requête invalide." };
  try {
    await updateTicket(user, ticketId, { status: status as never });
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    throw e;
  }
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
  return undefined;
}
