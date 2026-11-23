"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { createDraft } from "@/lib/services/documents";
import { getSettings } from "@/lib/services/settings";
import { workingDaysInMonth } from "@/lib/working-days";

export type ActionState = { error?: string } | undefined;

// "2026-08" (input type="month") → 1er du mois.
const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Mois invalide")
  .transform((s) => {
    const [y, m] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  });

const saveSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Choisissez un client"),
  label: z.string().min(2, "Libellé trop court").max(120),
  amountHt: z.coerce.number().positive("Montant invalide").max(1_000_000),
  mode: z.enum(["FIXED", "DAILY"]),
  activity: z.enum(["SERVICE_BNC", "GOODS"]),
  startsOn: monthString,
  endsOn: z
    .string()
    .transform((s) => (s ? s : null))
    .pipe(monthString.nullable()),
});

/** Crée ou met à jour un revenu récurrent (MRR) — admin. */
export async function saveRecurringRevenueAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = saveSchema.safeParse({
    id: formData.get("id") || undefined,
    clientId: formData.get("clientId"),
    label: formData.get("label"),
    amountHt: formData.get("amountHt"),
    mode: formData.get("mode"),
    activity: formData.get("activity"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, endsOn, startsOn, ...data } = parsed.data;
  if (endsOn && endsOn < startsOn) {
    return { error: "Le mois de fin est avant le mois de début." };
  }

  if (id) {
    await db.recurringRevenue.update({
      where: { id },
      data: { ...data, startsOn, endsOn },
    });
  } else {
    await db.recurringRevenue.create({ data: { ...data, startsOn, endsOn } });
  }
  revalidatePath("/admin/finance");
  return undefined;
}

/**
 * Crée le brouillon de facture du mois pour un revenu récurrent, pré-rempli
 * (client, libellé, TJM × jours ouvrés ou montant fixe), puis redirige vers
 * le brouillon. Rien n'est émis : relecture et émission restent manuelles.
 */
export async function createRecurringDraftAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Requête invalide." };

  const [rec, settings] = await Promise.all([
    db.recurringRevenue.findUnique({ where: { id } }),
    getSettings(),
  ]);
  if (!rec) return { error: "Revenu récurrent introuvable." };

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(now);
  const days = workingDaysInMonth(now.getFullYear(), now.getMonth() + 1);
  const amount = Number(rec.amountHt);

  const doc = await createDraft({
    type: "INVOICE",
    clientId: rec.clientId,
    activity: rec.activity,
    vatRate: Number(settings.defaultVatRate),
    items:
      rec.mode === "DAILY"
        ? [
            {
              description: `${rec.label} — ${monthLabel} (${days} jours ouvrés)`,
              quantity: days,
              unitPrice: amount,
            },
          ]
        : [
            {
              description: `${rec.label} — ${monthLabel}`,
              quantity: 1,
              unitPrice: amount,
            },
          ],
  });

  revalidatePath("/admin/finance");
  revalidatePath("/admin/documents");
  redirect(`/admin/documents/${doc.id}`);
}

/** Supprime un revenu récurrent — admin. */
export async function deleteRecurringRevenueAction(id: string): Promise<ActionState> {
  await requireAdmin();
  if (!id) return { error: "Requête invalide." };
  await db.recurringRevenue.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/finance");
  return undefined;
}
