import { requireAdmin } from "@/lib/authz";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";

export const metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Recevez les alertes du back office directement sur vos appareils.
        </p>
      </div>
      <div className="max-w-xl">
        <PushNotificationsCard />
      </div>
    </div>
  );
}
