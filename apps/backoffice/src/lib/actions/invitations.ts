"use server";

import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export type AcceptState = { error?: string; ok?: boolean } | undefined;

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Le nom est requis").max(200),
  password: z.string().min(8, "8 caractères minimum").max(128),
});

export async function acceptInvitationAction(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { token, name, password } = parsed.data;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { client: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return { error: "Invitation invalide ou expirée." };
  }

  const existing = await db.user.findUnique({
    where: { email: invitation.email },
  });
  if (existing) return { error: "Un compte existe déjà avec cet email." };

  await auth.api.createUser({
    body: {
      email: invitation.email,
      password,
      name,
      role: "CLIENT" as "user",
    },
  });

  // clientId est en input:false (non modifiable via l'API auth) → set direct en DB.
  await db.user.update({
    where: { email: invitation.email },
    data: { clientId: invitation.clientId, emailVerified: true },
  });

  await db.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return { ok: true };
}

export async function getInvitationByToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { client: { select: { name: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return null;
  }
  return { email: invitation.email, clientName: invitation.client.name };
}
