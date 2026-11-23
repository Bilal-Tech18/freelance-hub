import { requireAdmin } from "@/lib/authz";
import { ReferrerForm } from "@/components/referrers/referrer-form";
import { BackButton } from "@/components/nav/back-button";

export const metadata = { title: "Nouvel apporteur" };

export default async function NewReferrerPage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl space-y-6">
      <BackButton href="/admin/referrers" label="Apporteurs" />
      <h1 className="text-2xl font-semibold">Nouvel apporteur d&apos;affaires</h1>
      <ReferrerForm />
    </div>
  );
}
