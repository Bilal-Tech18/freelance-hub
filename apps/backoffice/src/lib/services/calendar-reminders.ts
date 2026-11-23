import "server-only";

import { db } from "@/lib/db";
import { sendCalendarReminderEmail } from "@/lib/emails";
import { addDays, occurrencesBetween, parisNow } from "@/lib/recurrence";

// Heure du rappel pour une tâche « toute la journée ».
const DEFAULT_REMINDER_TIME = "09:00";

/**
 * Rappels du calendrier : push + email à l'admin quand une occurrence
 * arrive (N jours avant, à l'heure de la tâche ou à 9 h). Un seul envoi
 * groupé par tick, chaque occurrence n'est rappelée qu'une fois et jamais
 * si elle est déjà cochée. Le tick tourne toutes les 30 min : le rappel peut
 * partir jusqu'à 30 min après l'heure prévue.
 */
export async function remindCalendarTasks(now = new Date()) {
  const { day: today, time } = parisNow(now);
  const nowKey = `${today}T${time}`;

  const tasks = await db.calendarTask.findMany({
    where: { remindDaysBefore: { not: null } },
  });

  const due: { taskId: string; date: string; title: string; time: string | null; notes: string }[] = [];
  for (const task of tasks) {
    const lead = task.remindDaysBefore ?? 0;
    for (const date of occurrencesBetween(task, today, addDays(today, lead))) {
      const trigger = `${addDays(date, -lead)}T${task.time ?? DEFAULT_REMINDER_TIME}`;
      if (nowKey >= trigger) {
        due.push({ taskId: task.id, date, title: task.title, time: task.time, notes: task.notes });
      }
    }
  }
  if (due.length === 0) return { sent: 0 };

  const states = await db.calendarOccurrence.findMany({
    where: { OR: due.map(({ taskId, date }) => ({ taskId, date })) },
  });
  const pending = due.filter(
    (o) => !states.some((s) => s.taskId === o.taskId && s.date === o.date && (s.doneAt || s.notifiedAt))
  );
  if (pending.length === 0) return { sent: 0 };

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  await sendCalendarReminderEmail({
    tasks: pending.map((o) => ({
      title: o.title,
      notes: o.notes,
      when:
        (o.date === today ? "aujourd'hui" : dateFmt.format(new Date(`${o.date}T00:00:00Z`))) +
        (o.time ? ` à ${o.time}` : ""),
    })),
  });

  await db.$transaction(
    pending.map(({ taskId, date }) =>
      db.calendarOccurrence.upsert({
        where: { taskId_date: { taskId, date } },
        create: { taskId, date, notifiedAt: now },
        update: { notifiedAt: now },
      })
    )
  );
  return { sent: pending.length };
}
