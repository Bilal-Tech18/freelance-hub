import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key";
import { getStats } from "@/lib/services/stats";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, ["stats:read"]);
  if (!auth.ok) return auth.response;

  // Les stats sont des données propriétaire (CA, SLA global) : jamais exposées
  // à une clé cliente, même avec le scope stats:read.
  if (auth.actor.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Réservé à l'administrateur." } },
      { status: 403 }
    );
  }

  const stats = await getStats();
  return NextResponse.json({ stats });
}
