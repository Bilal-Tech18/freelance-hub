"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string } | undefined;

const KEY_RE = /^[a-z]+-\d{4}(-\d{2})?$/;

/** Coche / décoche une échéance déclarative (présence de la clé = fait). */
export async function toggleComplianceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!KEY_RE.test(key)) return { error: "Échéance invalide." };

  const existing = await db.complianceDone.findUnique({ where: { key } });
  if (existing) {
    await db.complianceDone.delete({ where: { key } });
  } else {
    await db.complianceDone.create({ data: { key } });
  }
  revalidatePath("/admin/finance");
  return undefined;
}
