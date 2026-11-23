"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { providerFields } from "@/lib/credentials";
import {
  assertProjectAccess,
  createVaultEntry,
  deleteVaultEntry,
  revealVaultEntry,
  updateVaultEntry,
} from "@/lib/services/vault";

export type ActionState = { error?: string; saved?: boolean } | undefined;
export type RevealState =
  | { error?: string; fields?: Record<string, string> }
  | undefined;

const PROVIDER_ENUM = z.enum([
  "RENDER", "VERCEL", "AZURE", "AWS", "GCP", "OVH", "CLOUDFLARE", "GITHUB",
  "GITLAB", "CLOUDINARY", "STRIPE", "DOMAIN_REGISTRAR", "DATABASE", "SMTP_EMAIL",
  "CMS", "ANALYTICS", "SOCIAL", "FTP_SSH", "OTHER",
]);

function pickFields(provider: string, raw: Record<string, unknown>) {
  const allowed = providerFields(provider).map((f) => f.key);
  const fields: Record<string, string> = {};
  for (const k of allowed) {
    if (raw[k] != null && String(raw[k]).trim() !== "") fields[k] = String(raw[k]);
  }
  return fields;
}

const createSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  provider: PROVIDER_ENUM,
  label: z.string().min(1).max(120),
  fields: z.string(),
});

/** Ajout manuel d'une entrée au Vault (admin ou client sur son périmètre). */
export async function createVaultEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId") || undefined,
    provider: formData.get("provider"),
    label: formData.get("label"),
    fields: formData.get("fields"),
  });
  if (!parsed.success) return { error: "Données invalides." };

  // Un client ne peut créer que pour son propre Client
  if (user.role !== "ADMIN" && parsed.data.clientId !== user.clientId) {
    return { error: "Accès refusé." };
  }
  if (parsed.data.projectId) {
    const clientId = await assertProjectAccess(user, parsed.data.projectId);
    if (!clientId) return { error: "Accès refusé." };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(parsed.data.fields);
  } catch {
    return { error: "Champs invalides." };
  }
  const fields = pickFields(parsed.data.provider, raw);
  if (Object.keys(fields).length === 0) return { error: "Renseignez au moins un champ." };

  await createVaultEntry(user, {
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId ?? null,
    provider: parsed.data.provider,
    label: parsed.data.label,
    fields,
  });
  revalidatePath("/admin/vault");
  revalidatePath("/vault");
  revalidatePath("/maintenance/vault");
  return { saved: true };
}

const updateSchema = z.object({
  id: z.string().min(1),
  provider: PROVIDER_ENUM,
  label: z.string().min(1).max(120),
  fields: z.string(),
});

export async function updateVaultEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    provider: formData.get("provider"),
    label: formData.get("label"),
    fields: formData.get("fields"),
  });
  if (!parsed.success) return { error: "Données invalides." };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(parsed.data.fields);
  } catch {
    return { error: "Champs invalides." };
  }
  const fields = pickFields(parsed.data.provider, raw);
  const res = await updateVaultEntry(user, parsed.data.id, {
    label: parsed.data.label,
    fields,
  });
  if (!res) return { error: "Accès refusé." };
  revalidatePath("/admin/vault");
  revalidatePath("/vault");
  revalidatePath("/maintenance/vault");
  return { saved: true };
}

export async function deleteVaultEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Entrée manquante." };
  const ok = await deleteVaultEntry(user, id);
  if (!ok) return { error: "Accès refusé." };
  revalidatePath("/admin/vault");
  revalidatePath("/vault");
  revalidatePath("/maintenance/vault");
  return { saved: true };
}

/** Déchiffre et renvoie les champs — contrôle d'accès dans le service. */
export async function revealVaultEntryAction(
  _prev: RevealState,
  formData: FormData
): Promise<RevealState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Entrée manquante." };
  const res = await revealVaultEntry(user, id);
  if (!res) return { error: "Accès refusé." };
  return { fields: res.fields };
}
