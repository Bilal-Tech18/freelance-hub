"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

/** Enregistre (ou ré-attribue) l'abonnement push de l'appareil courant. */
export async function subscribePushAction(input: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "Abonnement invalide." };

  const { endpoint, keys } = parsed.data;
  // Un appareil qui change d'utilisateur (déconnexion/reconnexion) garde le
  // même endpoint : l'upsert re-rattache l'abonnement au compte courant.
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return {};
}

/** Supprime l'abonnement push de l'appareil courant. */
export async function unsubscribePushAction(endpoint: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!endpoint) return { error: "Requête invalide." };
  // Scopé à l'utilisateur : impossible de supprimer l'abonnement d'un autre compte.
  await db.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });
  return {};
}
