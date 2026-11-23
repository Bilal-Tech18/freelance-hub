"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  subscribePushAction,
  unsubscribePushAction,
} from "@/lib/actions/push";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, BellOff, BellRing, Share, SquarePlus } from "lucide-react";

type Status =
  | "loading"
  | "unsupported" // navigateur sans Web Push
  | "ios-install" // iPhone/iPad : PWA pas encore installée sur l'écran d'accueil
  | "denied" // permission refusée dans les réglages du navigateur
  | "off"
  | "on";

// Clé publique VAPID → format attendu par pushManager.subscribe().
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIosWithoutStandalone() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    "standalone" in navigator &&
    (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/**
 * Activation des notifications push sur l'appareil courant (PWA).
 * Sur iPhone, le Web Push n'existe que si l'app est installée sur l'écran
 * d'accueil : on guide l'utilisateur avant de proposer l'activation.
 */
export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(isIosWithoutStandalone() ? "ios-install" : "unsupported");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "on" : "off");
    }
    init().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Clé de notification manquante côté serveur.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const result = await subscribePushAction(subscription.toJSON());
      if (result.error) {
        toast.error(result.error);
        await subscription.unsubscribe();
        return;
      }
      setStatus("on");
      toast.success("Notifications activées sur cet appareil.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
      toast.success("Notifications désactivées sur cet appareil.");
    } catch {
      toast.error("Impossible de désactiver les notifications.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" />
          Notifications push
        </CardTitle>
        <CardDescription>
          Recevez sur cet appareil les mêmes alertes que par email : nouveaux
          tickets, réponses, correctifs à valider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Vérification…</p>
        )}

        {status === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Ce navigateur ne prend pas en charge les notifications push.
          </p>
        )}

        {status === "ios-install" && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Sur iPhone, installez d&apos;abord l&apos;application sur votre
              écran d&apos;accueil :
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li className="flex items-center gap-1.5 list-none -ml-5">
                <Share className="size-4 shrink-0" />
                Touchez « Partager » dans Safari
              </li>
              <li className="flex items-center gap-1.5 list-none -ml-5">
                <SquarePlus className="size-4 shrink-0" />
                Puis « Sur l&apos;écran d&apos;accueil »
              </li>
            </ol>
            <p>
              Ouvrez ensuite l&apos;app depuis sa nouvelle icône et revenez sur
              cette page pour activer les notifications.
            </p>
          </div>
        )}

        {status === "denied" && (
          <p className="text-sm text-muted-foreground">
            Les notifications sont bloquées pour cette app. Réautorisez-les dans
            les réglages du navigateur (ou de l&apos;app installée), puis
            rechargez cette page.
          </p>
        )}

        {status === "off" && (
          <Button onClick={enable} disabled={pending}>
            <BellRing className="size-4 mr-1" />
            {pending ? "Activation…" : "Activer sur cet appareil"}
          </Button>
        )}

        {status === "on" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <BellRing className="size-4" />
              Notifications actives sur cet appareil
            </p>
            <Button variant="outline" size="sm" onClick={disable} disabled={pending}>
              <BellOff className="size-4 mr-1" />
              {pending ? "Désactivation…" : "Désactiver"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
