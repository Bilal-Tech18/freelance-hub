import "server-only";

import { db } from "@/lib/db";

const SINGLETON_ID = "app";

/** Réglages émetteur (singleton). Créé à la volée s'il n'existe pas. */
export async function getSettings() {
  const existing = await db.setting.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;
  return db.setting.create({ data: { id: SINGLETON_ID } });
}
