"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

/** Démarre le timer sur un projet (et arrête l'éventuel timer en cours). */
export async function startTimerAction(projectId: string) {
  await requireAdmin();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "Projet introuvable." };

  const now = new Date();
  await db.$transaction([
    db.timeEntry.updateMany({
      where: { endedAt: null },
      data: { endedAt: now },
    }),
    db.timeEntry.create({ data: { projectId, startedAt: now } }),
  ]);
  revalidatePath("/admin/time");
  return { ok: true };
}

export async function stopTimerAction() {
  await requireAdmin();
  await db.timeEntry.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date() },
  });
  revalidatePath("/admin/time");
  return { ok: true };
}

export async function deleteTimeEntryAction(id: string) {
  await requireAdmin();
  await db.timeEntry.deleteMany({ where: { id } });
  revalidatePath("/admin/time");
  return { ok: true };
}
