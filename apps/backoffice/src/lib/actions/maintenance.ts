"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireMaintainer } from "@/lib/authz";
import { DEFAULT_MAINTENANCE_PALETTE, HEX_RE } from "@/lib/palette";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** Assigne / retire un projet à un mainteneur (admin uniquement). */
export async function assignProjectAction(input: {
  projectId: string;
  userId: string;
  assigned: boolean;
}): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      projectId: z.string().min(1),
      userId: z.string().min(1),
      assigned: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Requête invalide." };

  const { projectId, userId, assigned } = parsed.data;
  const maintainer = await db.user.findFirst({
    where: { id: userId, role: "MAINTAINER" },
    select: { id: true },
  });
  if (!maintainer) return { error: "Mainteneur introuvable." };

  if (assigned) {
    await db.projectAssignment.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: {},
      create: { userId, projectId },
    });
  } else {
    await db.projectAssignment.deleteMany({ where: { userId, projectId } });
  }
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/maintenance");
  return { ok: true };
}

const paletteSchema = z.object({
  c1: z.string().regex(HEX_RE),
  c2: z.string().regex(HEX_RE),
  c3: z.string().regex(HEX_RE),
  c4: z.string().regex(HEX_RE),
});

/** Le mainteneur personnalise la palette de son espace. */
export async function updatePaletteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireMaintainer();
  const parsed = paletteSchema.safeParse({
    c1: formData.get("c1"),
    c2: formData.get("c2"),
    c3: formData.get("c3"),
    c4: formData.get("c4"),
  });
  if (!parsed.success) return { error: "Couleurs invalides (format #RRGGBB)." };

  await db.user.update({ where: { id: user.id }, data: { palette: parsed.data } });
  revalidatePath("/maintenance", "layout");
  return { ok: true };
}

/** Réinitialise la palette par défaut. */
export async function resetPaletteAction(): Promise<ActionState> {
  const user = await requireMaintainer();
  await db.user.update({
    where: { id: user.id },
    data: { palette: DEFAULT_MAINTENANCE_PALETTE },
  });
  revalidatePath("/maintenance", "layout");
  return { ok: true };
}
