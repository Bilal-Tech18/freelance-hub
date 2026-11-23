import { requireAdmin } from "@/lib/authz";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export const metadata = { title: "Sécurité" };

export default async function SecuritySettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sécurité</h1>
        <p className="text-sm text-muted-foreground">
          Gérez le mot de passe de votre compte administrateur.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
