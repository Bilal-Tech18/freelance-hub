import "server-only";

import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/services/tickets";

export const API_SCOPES = [
  "projects:read",
  "tickets:read",
  "tickets:write",
  "comments:write",
  "stats:read",
  "finance:read",
  "documents:read",
  "documents:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function generateApiKey() {
  const raw = `sk_live_${randomBytes(24).toString("hex")}`;
  return {
    raw,
    hash: createHash("sha256").update(raw).digest("hex"),
    prefix: raw.slice(0, 16),
  };
}

export type ApiAuthResult =
  | { ok: true; actor: Actor; scopes: string[] }
  | { ok: false; response: NextResponse };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function authenticateApiKey(
  request: Request,
  requiredScopes: ApiScope[]
): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return {
      ok: false,
      response: errorResponse(401, "UNAUTHORIZED", "Missing Bearer API key."),
    };
  }

  const keyHash = createHash("sha256").update(token).digest("hex");
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (
    !apiKey ||
    apiKey.revokedAt ||
    (apiKey.expiresAt && apiKey.expiresAt < new Date())
  ) {
    return {
      ok: false,
      response: errorResponse(401, "UNAUTHORIZED", "Invalid or revoked API key."),
    };
  }

  const missing = requiredScopes.filter((s) => !apiKey.scopes.includes(s));
  if (missing.length > 0) {
    return {
      ok: false,
      response: errorResponse(
        403,
        "FORBIDDEN",
        `Missing scope(s): ${missing.join(", ")}.`
      ),
    };
  }

  // Fire-and-forget : ne pas bloquer la requête sur ce write
  db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    ok: true,
    scopes: apiKey.scopes,
    actor: {
      id: apiKey.user.id,
      name: apiKey.user.name,
      role: apiKey.user.role,
      clientId: apiKey.user.clientId,
    },
  };
}
