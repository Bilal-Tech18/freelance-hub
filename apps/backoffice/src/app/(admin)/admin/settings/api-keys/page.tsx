import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { ApiKeyManager } from "@/components/api-keys/api-key-manager";
import { BackButton } from "@/components/nav/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDown } from "lucide-react";

export const metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const admin = await requireAdmin();
  const keys = await db.apiKey.findMany({
    where: { userId: admin.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <BackButton href="/admin" label="Dashboard" />
      <h1 className="text-2xl font-semibold">API keys</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentation agent IA</CardTitle>
          <CardDescription>
            Guide complet de l&apos;API (endpoints, scopes, serveur MCP) à donner
            à votre agent avec sa clé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <a href="/api/docs/agent-api" download>
              <FileDown className="size-4 mr-1" /> Télécharger le .md
            </a>
          </Button>
        </CardContent>
      </Card>
      <ApiKeyManager
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
