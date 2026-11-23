"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const str = z.string().max(300).optional();

const schema = z.object({
  sellerName: str,
  sellerLegalForm: str,
  sellerAddressLine1: str,
  sellerAddressLine2: str,
  sellerPostalCode: str,
  sellerCity: str,
  sellerCountry: str,
  sellerEmail: str,
  sellerPhone: str,
  siret: str,
  vatNumber: str,
  apeCode: str,
  iban: str,
  bic: str,
  bankName: str,
  invoicePrefix: z.string().min(1).max(10),
  quotePrefix: z.string().min(1).max(10),
  defaultVatRate: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  quoteValidityDays: z.coerce.number().int().min(0).max(365),
  vatExempt: z.coerce.boolean(),
  legalMentions: z.string().max(2000).optional(),
});

export async function updateUrssafRateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const rateSchema = z.coerce.number().min(0).max(100);
  const parsed = z
    .object({ urssafRate: rateSchema, urssafRateGoods: rateSchema })
    .safeParse({
      urssafRate: formData.get("urssafRate"),
      urssafRateGoods: formData.get("urssafRateGoods"),
    });
  if (!parsed.success) return { error: "Taux invalide." };

  await db.setting.upsert({
    where: { id: "app" },
    create: { id: "app", ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  return { saved: true };
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({
    ...raw,
    vatExempt: formData.get("vatExempt") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  await db.setting.upsert({
    where: { id: "app" },
    create: { id: "app", ...data },
    update: data,
  });
  revalidatePath("/admin/settings/billing");
  return { saved: true };
}
