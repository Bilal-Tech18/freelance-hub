"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/authz";
import { providerFields } from "@/lib/credentials";
import {
  assertProjectAccess,
  createVaultEntry,
} from "@/lib/services/vault";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const PROVIDER_ENUM = z.enum([
  "RENDER", "VERCEL", "AZURE", "AWS", "GCP", "OVH", "CLOUDFLARE", "GITHUB",
  "GITLAB", "CLOUDINARY", "STRIPE", "DOMAIN_REGISTRAR", "DATABASE", "SMTP_EMAIL",
  "CMS", "ANALYTICS", "SOCIAL", "FTP_SSH", "OTHER",
]);

// ---------- Admin : demandes de comptes par projet ----------

const requestSchema = z.object({
  projectId: z.string().min(1),
  provider: PROVIDER_ENUM,
  label: z.string().min(1).max(120),
  instructions: z.string().max(1000).optional(),
  required: z.coerce.boolean().optional(),
});

export async function addCredentialRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = requestSchema.safeParse({
    projectId: formData.get("projectId"),
    provider: formData.get("provider"),
    label: formData.get("label"),
    instructions: formData.get("instructions") || undefined,
    required: formData.get("required") === "on",
  });
  if (!parsed.success) return { error: "Données invalides." };

  const max = await db.credentialRequest.aggregate({
    where: { projectId: parsed.data.projectId },
    _max: { order: true },
  });
  await db.credentialRequest.create({
    data: {
      projectId: parsed.data.projectId,
      provider: parsed.data.provider,
      label: parsed.data.label,
      instructions: parsed.data.instructions,
      required: parsed.data.required ?? true,
      order: (max._max.order ?? 0) + 1,
    },
  });
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  return { saved: true };
}

export async function deleteCredentialRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Demande manquante." };
  const req = await db.credentialRequest.delete({ where: { id } });
  revalidatePath(`/admin/projects/${req.projectId}`);
  return undefined;
}

// ---------- Client/Admin : fournir un credential (onboarding ou vault) ----------

const fulfillSchema = z.object({
  requestId: z.string().min(1),
  fields: z.string(), // JSON
});

export async function fulfillCredentialRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = fulfillSchema.safeParse({
    requestId: formData.get("requestId"),
    fields: formData.get("fields"),
  });
  if (!parsed.success) return { error: "Données invalides." };

  const request = await db.credentialRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { credential: true },
  });
  if (!request) return { error: "Demande introuvable." };

  // Contrôle d'accès : le projet doit appartenir à l'acteur (ou admin)
  const clientId = await assertProjectAccess(user, request.projectId);
  if (!clientId) return { error: "Accès refusé." };

  // Filtre les champs aux clés attendues du provider
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(parsed.data.fields);
  } catch {
    return { error: "Champs invalides." };
  }
  const allowed = providerFields(request.provider).map((f) => f.key);
  const fields: Record<string, string> = {};
  for (const k of allowed) {
    if (raw[k] != null && String(raw[k]).trim() !== "") fields[k] = String(raw[k]);
  }
  if (Object.keys(fields).length === 0) return { error: "Renseignez au moins un champ." };

  if (request.credential) {
    // maj de l'entrée existante liée
    const { updateVaultEntry } = await import("@/lib/services/vault");
    await updateVaultEntry(user, request.credential.id, { fields });
  } else {
    await createVaultEntry(user, {
      clientId,
      projectId: request.projectId,
      provider: request.provider,
      label: request.label,
      fields,
      requestId: request.id,
    });
  }
  await db.credentialRequest.update({
    where: { id: request.id },
    data: { status: "PROVIDED" },
  });

  revalidatePath(`/projects/${request.projectId}/onboarding`);
  revalidatePath(`/admin/projects/${request.projectId}`);
  return { saved: true };
}

export async function skipCredentialRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("requestId") ?? "");
  if (!id) return { error: "Demande manquante." };
  const request = await db.credentialRequest.findUnique({ where: { id } });
  if (!request) return { error: "Demande introuvable." };
  const clientId = await assertProjectAccess(user, request.projectId);
  if (!clientId) return { error: "Accès refusé." };
  await db.credentialRequest.update({ where: { id }, data: { status: "SKIPPED" } });
  revalidatePath(`/projects/${request.projectId}/onboarding`);
  return { saved: true };
}
