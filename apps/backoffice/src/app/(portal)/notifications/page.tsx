import { requireUser } from "@/lib/authz";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";

export const metadata = { title: "Notifications" };

export default async function PortalNotificationsPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Soyez prévenu dès qu&apos;un correctif est prêt ou qu&apos;une réponse
          arrive sur vos tickets.
        </p>
      </div>
      <div className="max-w-xl">
        <PushNotificationsCard />
      </div>
    </div>
  );
}
