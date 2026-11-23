"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type ActionState = { error?: string } | undefined;

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Titre requis").max(200),
  dueDate: z.string().optional(),
});

function revalidateProject(projectId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createMilestoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const max = await db.milestone.aggregate({
    where: { projectId: parsed.data.projectId },
    _max: { order: true },
  });
  await db.milestone.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      order: (max._max.order ?? 0) + 1,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });
  revalidateProject(parsed.data.projectId);
  return undefined;
}

const statusSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]),
});

export async function updateMilestoneStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Données invalides." };

  const milestone = await db.milestone.update({
    where: { id: parsed.data.milestoneId },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "DONE" ? new Date() : null,
      ...(parsed.data.status === "IN_PROGRESS" ? { startDate: new Date() } : {}),
    },
  });
  revalidateProject(milestone.projectId);
  return undefined;
}

export async function updateMilestoneDueDateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!milestoneId) return { error: "Jalon manquant." };
  const raw = String(formData.get("dueDate") ?? "");

  const milestone = await db.milestone.update({
    where: { id: milestoneId },
    data: { dueDate: raw ? new Date(raw) : null },
  });
  revalidateProject(milestone.projectId);
  return undefined;
}

export async function deleteMilestoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!milestoneId) return { error: "Jalon manquant." };
  const milestone = await db.milestone.delete({ where: { id: milestoneId } });
  revalidateProject(milestone.projectId);
  return undefined;
}
