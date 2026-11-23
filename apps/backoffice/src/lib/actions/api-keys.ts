"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { API_SCOPES, generateApiKey } from "@/lib/api-key";

export type CreateKeyState =
  | { error?: string; rawKey?: string; name?: string }
  | undefined;

const createSchema = z.object({
  name: z.string().min(1, "Nom requis").max(100),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Choisissez au moins un scope"),
});

export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData
): Promise<CreateKeyState> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { raw, hash, prefix } = generateApiKey();
  await db.apiKey.create({
    data: {
      name: parsed.data.name,
      keyHash: hash,
      prefix,
      scopes: parsed.data.scopes,
      userId: admin.id,
    },
  });

  revalidatePath("/admin/settings/api-keys");
  // La clé brute n'est renvoyée qu'ici, une seule fois.
  return { rawKey: raw, name: parsed.data.name };
}

export async function revokeApiKeyAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string } | undefined> {
  await requireAdmin();
  const id = String(formData.get("keyId") ?? "");
  if (!id) return { error: "Clé manquante." };
  await db.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/admin/settings/api-keys");
  return undefined;
}
