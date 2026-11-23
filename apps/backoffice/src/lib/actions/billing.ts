"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const str = z.string().max(300).optional();

const schema = z.object({
  clientId: z.string().min(1),
  billingType: z.enum(["COMPANY", "INDIVIDUAL"]),
  legalName: str,
  contactName: str,
  billingEmail: z.string().email("Email invalide").or(z.literal("")).optional(),
  addressLine1: str,
  addressLine2: str,
  postalCode: str,
  city: str,
  country: str,
  siret: str,
  siren: str,
  vatNumber: str,
  legalForm: str,
});

/** Enregistre les coordonnées de facturation d'un client (admin only). */
export async function updateClientBillingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { clientId, ...data } = parsed.data;
  await db.client.update({ where: { id: clientId }, data });
  revalidatePath(`/admin/clients/${clientId}`);
  return { saved: true };
}
