import { requireMaintainer } from "@/lib/authz";
import { listVault } from "@/lib/services/vault";
import { VaultList } from "@/components/vault/vault-list";

export const metadata = { title: "Vault" };

export default async function MaintenanceVaultPage() {
  const user = await requireMaintainer();
  const entries = await listVault(user);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Vault</h1>
        <p className="text-muted-foreground">
          Accès des projets qui te sont assignés — lecture seule, chiffrés au
          repos (AES-256-GCM).
        </p>
      </div>
      <VaultList
        items={entries.map((e) => ({
          id: e.id,
          provider: e.provider,
          label: e.label,
          clientName: e.client.name,
          projectName: e.project?.name ?? null,
          updatedAt: e.updatedAt.toISOString(),
        }))}
        showClient
        readOnly
      />
    </div>
  );
}
