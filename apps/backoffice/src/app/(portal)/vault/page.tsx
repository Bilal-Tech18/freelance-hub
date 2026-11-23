import { requireUser } from "@/lib/authz";
import { listVault } from "@/lib/services/vault";
import { VaultList } from "@/components/vault/vault-list";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquareOff, RefreshCcw, ShieldCheck } from "lucide-react";

export const metadata = { title: "Mes accès" };

const WHY_VAULT = [
  {
    icon: MessageSquareOff,
    title: "Fini les mots de passe par WhatsApp ou email",
    body: "Un identifiant envoyé dans une conversation y reste pour toujours, en clair. Ici, il ne transite jamais par un chat.",
  },
  {
    icon: ShieldCheck,
    title: "Chiffré, pas simplement stocké",
    body: "Chaque accès est chiffré (AES-256-GCM) en base : même en cas de fuite, il est illisible sans la clé.",
  },
  {
    icon: RefreshCcw,
    title: "Déposé une fois, disponible toujours",
    body: "Plus besoin de vous redemander les accès à chaque intervention : ils sont là, à jour, et vous gardez la main pour les modifier.",
  },
];

export default async function ClientVaultPage() {
  const user = await requireUser();
  if (!user.clientId) {
    return (
      <p className="text-muted-foreground">Aucun espace client associé.</p>
    );
  }
  const entries = await listVault(user);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Mes accès</h1>
          <p className="text-muted-foreground">
            Les identifiants que vous m&apos;avez confiés, chiffrés et privés.
            Vous seul et moi pouvons les voir.
          </p>
        </div>
        <VaultList
          items={entries.map((e) => ({
            id: e.id,
            provider: e.provider,
            label: e.label,
            projectName: e.project?.name ?? null,
            updatedAt: e.updatedAt.toISOString(),
          }))}
          clientId={user.clientId}
        />
      </div>

      <Card className="bg-muted/30 lg:justify-self-end lg:mr-1 lg:sticky lg:top-6 w-full">
        <CardContent className="space-y-4 py-4">
          {WHY_VAULT.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-2 text-sm">
              <Icon className="size-4 mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
