"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string } | undefined;

const pricingSchema = z.object({
  projectId: z.string().min(1),
  // Absent quand le projet a des versions : le montant est leur somme.
  amountHt: z.coerce.number().min(0).max(10_000_000).optional(),
  vatRate: z.coerce.number().min(0).max(100),
});

export async function setProjectPricingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = pricingSchema.safeParse({
    projectId: formData.get("projectId"),
    amountHt: formData.get("amountHt") ?? undefined,
    vatRate: formData.get("vatRate"),
  });
  if (!parsed.success) return { error: "Montant ou taux invalide." };

  // Avec des versions, le montant est géré par leur somme : on ne l'écrase pas.
  const hasVersions =
    (await db.projectVersion.count({ where: { projectId: parsed.data.projectId } })) > 0;
  await db.project.update({
    where: { id: parsed.data.projectId },
    data: {
      vatRate: parsed.data.vatRate,
      ...(parsed.data.amountHt !== undefined && !hasVersions
        ? { amountHt: parsed.data.amountHt }
        : {}),
    },
  });
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  return undefined;
}

const paymentSchema = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive("Montant invalide").max(10_000_000),
  method: z.string().max(50).optional(),
  paidAt: z.string().optional(),
  note: z.string().max(500).optional(),
  versionId: z.string().optional(),
});

export async function addPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse({
    projectId: formData.get("projectId"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    paidAt: formData.get("paidAt") || undefined,
    note: formData.get("note") || undefined,
    versionId: formData.get("versionId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.versionId) {
    const version = await db.projectVersion.findUnique({
      where: { id: parsed.data.versionId },
      select: { projectId: true },
    });
    if (!version || version.projectId !== parsed.data.projectId)
      return { error: "Version invalide pour ce projet." };
  }

  await db.payment.create({
    data: {
      projectId: parsed.data.projectId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
      note: parsed.data.note,
      versionId: parsed.data.versionId,
    },
  });
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  return undefined;
}

export async function deletePaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: "Paiement manquant." };
  const payment = await db.payment.delete({ where: { id: paymentId } });
  revalidatePath(`/admin/projects/${payment.projectId}`);
  return undefined;
}

const monthFinanceSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  adjBnc: z.coerce.number().min(0).max(10_000_000),
  adjGoods: z.coerce.number().min(0).max(10_000_000),
  urssaf: z.coerce.number().min(0).max(10_000_000),
});

/**
 * Enregistre en une fois les valeurs manuelles d'un mois :
 * CA manuel BNC, CA manuel ventes et URSSAF réellement payée.
 * 0 (ou vide) = suppression de la valeur manuelle.
 */
export async function saveMonthFinanceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = monthFinanceSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    adjBnc: formData.get("adjBnc") || 0,
    adjGoods: formData.get("adjGoods") || 0,
    urssaf: formData.get("urssaf") || 0,
  });
  if (!parsed.success) return { error: "Montant invalide." };
  const { year, month, adjBnc, adjGoods, urssaf } = parsed.data;

  const upsertAdjustment = async (
    activity: "SERVICE_BNC" | "GOODS",
    amountHt: number
  ) => {
    if (amountHt === 0) {
      await db.revenueAdjustment.deleteMany({ where: { year, month, activity } });
    } else {
      await db.revenueAdjustment.upsert({
        where: { year_month_activity: { year, month, activity } },
        create: { year, month, activity, amountHt },
        update: { amountHt },
      });
    }
  };

  await upsertAdjustment("SERVICE_BNC", adjBnc);
  await upsertAdjustment("GOODS", adjGoods);
  if (urssaf === 0) {
    await db.urssafOverride.deleteMany({ where: { year, month } });
  } else {
    await db.urssafOverride.upsert({
      where: { year_month: { year, month } },
      create: { year, month, amount: urssaf },
      update: { amount: urssaf },
    });
  }

  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  return undefined;
}
