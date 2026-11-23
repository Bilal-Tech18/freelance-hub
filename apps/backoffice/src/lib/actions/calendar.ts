"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { fiscalPeriodOf, fiscalTask, type FiscalKind } from "@/lib/fiscal-deadlines";
import { isOccurrence, parisNow } from "@/lib/recurrence";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Titre requis.").max(200),
    notes: z.string().trim().max(2000).default(""),
    startDate: day,
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.coerce.number().int().min(1).max(365),
    endDate: day.nullable(),
    remindDaysBefore: z.coerce.number().int().min(0).max(60).nullable(),
  })
  .refine((t) => !t.endDate || t.endDate >= t.startDate, {
    message: "La date de fin doit suivre la date de début.",
  });

export type CalendarTaskInput = z.input<typeof taskSchema>;

function revalidate() {
  revalidatePath("/admin/calendar");
}

/** Crée (sans id) ou met à jour une tâche. */
export async function saveCalendarTaskAction(id: string | null, input: CalendarTaskInput) {
  await requireAdmin();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tâche invalide." };
  const data = {
    ...parsed.data,
    interval: parsed.data.recurrence === "NONE" ? 1 : parsed.data.interval,
    endDate: parsed.data.recurrence === "NONE" ? null : parsed.data.endDate,
  };

  if (id) {
    const before = await db.calendarTask.findUnique({ where: { id } });
    if (!before) return { error: "Tâche introuvable." };
    await db.calendarTask.update({ where: { id }, data });
    // Nouvelle date ou nouvelle heure de rappel : les rappels déjà partis pour
    // les occurrences à venir ne comptent plus.
    if (before.time !== data.time || before.remindDaysBefore !== data.remindDaysBefore) {
      await db.calendarOccurrence.updateMany({
        where: { taskId: id, doneAt: null, notifiedAt: { not: null } },
        data: { notifiedAt: null },
      });
    }
  } else {
    await db.calendarTask.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function deleteCalendarTaskAction(id: string) {
  await requireAdmin();
  await db.calendarTask.deleteMany({ where: { id } });
  revalidate();
  return { ok: true };
}

/** Coche / décoche une occurrence précise d'une tâche. */
export async function toggleCalendarOccurrenceAction(taskId: string, date: string, done: boolean) {
  await requireAdmin();
  if (!day.safeParse(date).success) return { error: "Date invalide." };
  const task = await db.calendarTask.findUnique({ where: { id: taskId } });
  if (!task || !isOccurrence(task, date)) return { error: "Occurrence introuvable." };
  const doneAt = done ? new Date() : null;
  await db.calendarOccurrence.upsert({
    where: { taskId_date: { taskId, date } },
    create: { taskId, date, doneAt },
    update: { doneAt },
  });
  revalidate();
  return { ok: true };
}

const fiscalSchema = z.object({
  URSSAF: z.enum(["NONE", "MONTHLY", "QUARTERLY"]),
  TVA: z.enum(["NONE", "MONTHLY", "QUARTERLY"]),
  remindDaysBefore: z.coerce.number().int().min(0).max(60).nullable(),
});

/**
 * Échéances URSSAF / TVA : une tâche récurrente par type, créée, déplacée
 * (changement de périodicité) ou supprimée selon le choix.
 */
export async function saveFiscalRemindersAction(input: z.input<typeof fiscalSchema>) {
  await requireAdmin();
  const parsed = fiscalSchema.safeParse(input);
  if (!parsed.success) return { error: "Réglage invalide." };
  const { remindDaysBefore } = parsed.data;
  const today = parisNow().day;

  for (const kind of ["URSSAF", "TVA"] as FiscalKind[]) {
    const period = parsed.data[kind];
    const existing = await db.calendarTask.findUnique({ where: { preset: kind } });
    if (period === "NONE") {
      if (existing) await db.calendarTask.delete({ where: { id: existing.id } });
      continue;
    }
    if (existing && fiscalPeriodOf(existing) === period) {
      // Même périodicité : on garde la série (et ses coches), seul le rappel change.
      if (existing.remindDaysBefore !== remindDaysBefore) {
        await db.calendarTask.update({ where: { id: existing.id }, data: { remindDaysBefore } });
        await db.calendarOccurrence.updateMany({
          where: { taskId: existing.id, doneAt: null, notifiedAt: { not: null } },
          data: { notifiedAt: null },
        });
      }
      continue;
    }
    const data = { ...fiscalTask(kind, period, today), remindDaysBefore, preset: kind };
    if (existing) {
      await db.calendarTask.update({ where: { id: existing.id }, data });
    } else {
      await db.calendarTask.create({ data });
    }
  }
  revalidate();
  return { ok: true };
}
