import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { listVault } from "@/lib/services/vault";
import { VaultList } from "@/components/vault/vault-list";

export const metadata = { title: "Vault" };

export default async function AdminVaultPage() {
  const user = await requireAdmin();
  const [entries, clients] = await Promise.all([
    listVault(user),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Vault</h1>
        <p className="text-muted-foreground">
          Accès et identifiants de tes clients, chiffrés au repos (AES-256-GCM).
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
        clients={clients}
      />
    </div>
  );
}
