"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { sendInvitationEmail } from "@/lib/emails";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  contactEmail: z.string().email("Email invalide").or(z.literal("")),
  notes: z.string().max(5000).optional().default(""),
});

export async function createClientAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const client = await db.client.create({
    data: {
      name: parsed.data.name,
      contactEmail: parsed.data.contactEmail || null,
      notes: parsed.data.notes || null,
    },
  });
  redirect(`/admin/clients/${client.id}`);
}

export async function updateClientAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { error: "Client manquant." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db.client.update({
    where: { id: clientId },
    data: {
      name: parsed.data.name,
      contactEmail: parsed.data.contactEmail || null,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { saved: true };
}

/** Supprime un client et toutes ses données liées (irréversible). */
export async function deleteClientAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { error: "Client manquant." };

  await db.$transaction(async (tx) => {
    // Documents (facturés au client ou liés à ses projets)
    await tx.document.deleteMany({
      where: { OR: [{ clientId }, { project: { clientId } }] },
    });
    // Tickets des projets (commentaires + pièces jointes en cascade)
    await tx.ticket.deleteMany({ where: { project: { clientId } } });
    // Projets (jalons, paiements, onboarding en cascade)
    await tx.project.deleteMany({ where: { clientId } });
    // Comptes utilisateurs du client (sessions/comptes en cascade)
    await tx.user.deleteMany({ where: { clientId } });
    // Client (invitations en cascade)
    await tx.client.delete({ where: { id: clientId } });
  });

  redirect("/admin/clients");
}

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, "Le nom est requis").max(200),
  description: z.string().max(5000).optional().default(""),
  url: z.string().url("URL invalide").or(z.literal("")),
  activity: z.enum(["SERVICE_BNC", "GOODS"]).default("SERVICE_BNC"),
});

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    url: formData.get("url") ?? "",
    activity: formData.get("activity") ?? "SERVICE_BNC",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
  });
  if (!client) return { error: "Client introuvable." };

  const project = await db.project.create({
    data: {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      url: parsed.data.url || null,
      activity: parsed.data.activity,
      onboarding: { create: {} },
    },
  });
  redirect(`/admin/projects/${project.id}`);
}

const projectStatusSchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(["ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
});

export async function updateProjectStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = projectStatusSchema.safeParse({
    projectId: formData.get("projectId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Statut invalide." };

  await db.project.update({
    where: { id: parsed.data.projectId },
    data: { status: parsed.data.status },
  });
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  return { saved: true };
}

const projectProgressSchema = z.object({
  projectId: z.string().min(1),
  // "" = retour au calcul automatique depuis les jalons
  progress: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(100)])
    .transform((v) => (v === "" ? null : v)),
});

export async function updateProjectProgressAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = projectProgressSchema.safeParse({
    projectId: formData.get("projectId"),
    progress: formData.get("progress") ?? "",
  });
  if (!parsed.success) return { error: "Avancement invalide." };

  await db.project.update({
    where: { id: parsed.data.projectId },
    data: { progressOverride: parsed.data.progress },
  });
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { saved: true };
}

/**
 * Supprime un projet : tickets supprimés, factures/devis détachés (ils
 * restent rattachés au client), jalons/onboarding/paiements en cascade.
 */
export async function deleteProjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Projet manquant." };

  await db.$transaction(async (tx) => {
    await tx.document.updateMany({
      where: { projectId },
      data: { projectId: null },
    });
    await tx.ticket.deleteMany({ where: { projectId } });
    await tx.project.delete({ where: { id: projectId } });
  });

  redirect("/admin/projects");
}

const inviteSchema = z.object({
  clientId: z.string().min(1),
  email: z.string().email("Email invalide"),
});

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = inviteSchema.safeParse({
    clientId: formData.get("clientId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { clientId, email } = parsed.data;

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Client introuvable." };

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) return { error: "Un compte existe déjà avec cet email." };

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await db.invitation.create({
    data: {
      email,
      tokenHash,
      clientId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  await sendInvitationEmail({
    to: email,
    clientName: client.name,
    url: `${baseUrl}/invite/${token}`,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return undefined;
}
