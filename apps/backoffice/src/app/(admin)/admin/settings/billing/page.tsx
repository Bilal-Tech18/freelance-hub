import { requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/services/settings";
import { SellerSettingsForm } from "@/components/settings/seller-settings-form";
import { BackButton } from "@/components/nav/back-button";

export const metadata = { title: "Réglages facturation" };

export default async function BillingSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton href="/admin" label="Dashboard" />
      <div>
        <h1 className="text-2xl font-semibold">Réglages de facturation</h1>
        <p className="text-muted-foreground">
          Tes informations d&apos;émetteur, coordonnées bancaires et paramètres
          par défaut des documents.
        </p>
      </div>
      <SellerSettingsForm
        settings={{
          ...settings,
          defaultVatRate: Number(settings.defaultVatRate),
        }}
      />
    </div>
  );
}
