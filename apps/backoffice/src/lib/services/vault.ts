import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";
import { decryptFields, encryptFields } from "@/lib/vault-crypto";

/**
 * Filtre d'accès au Vault : admin => tout ; mainteneur => entrées de ses
 * projets assignés (+ entrées « client » des clients de ces projets) ;
 * client => uniquement son Client.
 */
export function scopedVaultWhere(user: SessionUser): Prisma.VaultCredentialWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "MAINTAINER") {
    const assigned = { some: { userId: user.id } };
    return {
      OR: [
        { project: { assignments: assigned } },
        // Entrée au niveau client (sans projet) d'un client dont au moins
        // un projet lui est assigné.
        { projectId: null, client: { projects: { some: { assignments: assigned } } } },
      ],
    };
  }
  return { clientId: user.clientId ?? "__none__" };
}

/** Le Vault est en lecture seule pour le mainteneur. */
export function canWriteVault(user: SessionUser) {
  return user.role !== "MAINTAINER";
}

/** Vérifie qu'un projet est accessible à l'acteur (retourne le clientId ou null). */
export async function assertProjectAccess(
  user: SessionUser,
  projectId: string
): Promise<string | null> {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      ...(user.role === "ADMIN"
        ? {}
        : user.role === "MAINTAINER"
          ? { assignments: { some: { userId: user.id } } }
          : { clientId: user.clientId ?? "__none__" }),
    },
    select: { clientId: true },
  });
  return project?.clientId ?? null;
}

export async function listVault(user: SessionUser, clientId?: string) {
  return db.vaultCredential.findMany({
    where: {
      ...scopedVaultWhere(user),
      ...(clientId && user.role === "ADMIN" ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Renvoie les champs déchiffrés d'une entrée — après contrôle d'accès. */
export async function revealVaultEntry(user: SessionUser, id: string) {
  const entry = await db.vaultCredential.findFirst({
    where: { id, ...scopedVaultWhere(user) },
  });
  if (!entry) return null;
  return { entry, fields: decryptFields(entry.data) };
}

type SaveInput = {
  clientId: string;
  projectId?: string | null;
  provider: string;
  label: string;
  fields: Record<string, string>;
  requestId?: string | null;
};

export async function createVaultEntry(user: SessionUser, input: SaveInput) {
  if (!canWriteVault(user)) return null;
  return db.vaultCredential.create({
    data: {
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      provider: input.provider as never,
      label: input.label,
      data: encryptFields(input.fields),
      requestId: input.requestId ?? null,
      createdById: user.id,
    },
  });
}

export async function updateVaultEntry(
  user: SessionUser,
  id: string,
  input: { label?: string; fields?: Record<string, string> }
) {
  if (!canWriteVault(user)) return null;
  const existing = await db.vaultCredential.findFirst({
    where: { id, ...scopedVaultWhere(user) },
  });
  if (!existing) return null;
  return db.vaultCredential.update({
    where: { id },
    data: {
      ...(input.label ? { label: input.label } : {}),
      ...(input.fields ? { data: encryptFields(input.fields) } : {}),
    },
  });
}

export async function deleteVaultEntry(user: SessionUser, id: string) {
  if (!canWriteVault(user)) return false;
  const existing = await db.vaultCredential.findFirst({
    where: { id, ...scopedVaultWhere(user) },
  });
  if (!existing) return false;
  // Libère la demande liée le cas échéant
  if (existing.requestId) {
    await db.credentialRequest.update({
      where: { id: existing.requestId },
      data: { status: "PENDING" },
    }).catch(() => {});
  }
  await db.vaultCredential.delete({ where: { id } });
  return true;
}
