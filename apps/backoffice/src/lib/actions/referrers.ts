"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const referrerSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  phone: z.string().max(50).optional(),
  iban: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  defaultCommissionRate: z.coerce.number().min(0).max(100),
});

export async function createReferrerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = referrerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const referrer = await db.referrer.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      iban: parsed.data.iban || null,
      notes: parsed.data.notes || null,
      defaultCommissionRate: parsed.data.defaultCommissionRate,
    },
  });
  redirect(`/admin/referrers/${referrer.id}`);
}

export async function updateReferrerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = referrerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!id) return { error: "Apporteur manquant." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.referrer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      iban: parsed.data.iban || null,
      notes: parsed.data.notes || null,
      defaultCommissionRate: parsed.data.defaultCommissionRate,
    },
  });
  revalidatePath(`/admin/referrers/${id}`);
  return undefined;
}

const payoutSchema = z.object({
  referrerId: z.string().min(1),
  amount: z.coerce.number().positive("Montant invalide").max(10_000_000),
  method: z.string().max(50).optional(),
  paidAt: z.string().optional(),
  note: z.string().max(500).optional(),
});

/** Enregistre un règlement versé à un apporteur. */
export async function addReferrerPayoutAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = payoutSchema.safeParse({
    referrerId: formData.get("referrerId"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    paidAt: formData.get("paidAt") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { referrerId, amount, method, paidAt, note } = parsed.data;

  await db.referrerPayout.create({
    data: {
      referrerId,
      amount,
      method: method || null,
      note: note || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
    },
  });
  revalidatePath(`/admin/referrers/${referrerId}`);
  revalidatePath("/admin/referrers");
  return { saved: true };
}

export async function deleteReferrerPayoutAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return { error: "Règlement manquant." };
  const payout = await db.referrerPayout.delete({ where: { id: payoutId } });
  revalidatePath(`/admin/referrers/${payout.referrerId}`);
  revalidatePath("/admin/referrers");
  return undefined;
}

const assignSchema = z.object({
  clientId: z.string().min(1),
  referrerId: z.string().optional(),
  referralDate: z.string().optional(),
  commissionRate: z.string().optional(),
  referralDurationMonths: z.coerce.number().int().min(1).max(60).default(12),
});

/** Assigne (ou retire) un apporteur à un client. */
export async function assignReferralAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = assignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Données invalides." };
  const { clientId, referrerId, referralDate, commissionRate, referralDurationMonths } =
    parsed.data;

  await db.client.update({
    where: { id: clientId },
    data: {
      referrerId: referrerId || null,
      referralDate:
        referrerId && referralDate ? new Date(referralDate) : referrerId ? new Date() : null,
      commissionRate:
        referrerId && commissionRate ? Number(commissionRate) : null,
      referralDurationMonths,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return { saved: true };
}
