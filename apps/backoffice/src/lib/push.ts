import "server-only";

import * as webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Web Push (PWA). Chaque notification email a son pendant push : l'envoi
 * est branché dans emails.ts, vers tous les appareils abonnés du destinataire.
 * Sans clés VAPID configurées, l'envoi est simplement ignoré.
 */

export type PushPayload = {
  title: string;
  body?: string;
  /** Chemin ouvert au clic sur la notification (défaut : racine de l'app). */
  path?: string;
};

function configuredWebpush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(
    `mailto:${process.env.EMAIL_REPLY_TO ?? "admin@example.com"}`,
    publicKey,
    privateKey
  );
  return webpush;
}

/** Envoie un push à tous les appareils abonnés de l'utilisateur (par email). */
export async function sendPushToEmail(email: string, payload: PushPayload) {
  const wp = configuredWebpush();
  if (!wp) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { user: { email } },
  });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await wp.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (e) {
        // 404/410 : abonnement expiré ou révoqué → on le retire.
        const statusCode = (e as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        } else {
          console.error("[push] send failed:", e);
        }
      }
    })
  );
}
