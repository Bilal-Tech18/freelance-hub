import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Chiffrement des secrets du Vault au repos (AES-256-GCM).
 * La clé vit uniquement côté serveur dans VAULT_ENCRYPTION_KEY (hex 64 car. = 32 octets).
 * Format stocké : base64( iv[12] | authTag[16] | ciphertext ).
 */

function getKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("VAULT_ENCRYPTION_KEY manquant : impossible de (dé)chiffrer le Vault.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY doit faire 32 octets (64 caractères hex).");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Chiffre un objet de champs (clé -> valeur). */
export function encryptFields(fields: Record<string, string>): string {
  return encryptSecret(JSON.stringify(fields));
}

export function decryptFields(payload: string): Record<string, string> {
  try {
    return JSON.parse(decryptSecret(payload));
  } catch {
    return {};
  }
}

/** Aperçu masqué d'une valeur secrète (pour l'affichage liste). */
export function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
