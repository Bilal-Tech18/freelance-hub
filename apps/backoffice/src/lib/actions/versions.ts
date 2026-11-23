"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import type { ActionState } from "@/lib/actions/payments";

/** Le montant HT du projet est la somme cachée de ses versions. */
async function recomputeProjectAmount(projectId: string) {
  const agg = await db.projectVersion.aggregate({
    where: { projectId },
    _sum: { amountHt: true },
    _count: true,
  });
  await db.project.update({
    where: { id: projectId },
    data: { amountHt: agg._count > 0 ? (agg._sum.amountHt ?? 0) : null },
  });
}

const addSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().trim().min(1, "Label requis").max(20),
  amountHt: z.coerce.number().positive("Montant invalide").max(10_000_000),
  note: z.string().max(200).optional(),
  documentId: z.string().optional(),
});

export async function addVersionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = addSchema.safeParse({
    projectId: formData.get("projectId"),
    label: formData.get("label"),
    amountHt: formData.get("amountHt"),
    note: formData.get("note") || undefined,
    documentId: formData.get("documentId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { projectId, label, amountHt, note, documentId } = parsed.data;

  if (documentId) {
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { projectId: true, type: true, projectVersion: { select: { id: true } } },
    });
    if (!doc || doc.projectId !== projectId || doc.type !== "QUOTE")
      return { error: "Devis introuvable pour ce projet." };
    if (doc.projectVersion)
      return { error: "Ce devis est déjà intégré à une version." };
  }

  try {
    await db.projectVersion.create({
      data: { projectId, label, amountHt, note, documentId },
    });
  } catch {
    return { error: "Création impossible (devis déjà intégré ?)." };
  }
  await recomputeProjectAmount(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  return undefined;
}

const deleteSchema = z.object({ versionId: z.string().min(1) });

export async function deleteVersionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = deleteSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) return { error: "Version invalide." };

  const version = await db.projectVersion.delete({
    where: { id: parsed.data.versionId },
    select: { projectId: true },
  });
  await recomputeProjectAmount(version.projectId);
  revalidatePath(`/admin/projects/${version.projectId}`);
  return undefined;
}
