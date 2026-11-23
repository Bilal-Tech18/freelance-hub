import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { addDays, occurrencesBetween, parisNow, weekdayIndex } from "@/lib/recurrence";
import { fiscalPeriodOf } from "@/lib/fiscal-deadlines";
import { CalendarView, type CalendarEntry } from "@/components/calendar/calendar-view";

export const metadata = { title: "Calendrier" };

// Fenêtre de l'agenda : tâches en retard non cochées / à venir.
const OVERDUE_DAYS = 30;
const UPCOMING_DAYS = 30;

function lastDayOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const today = parisNow().day;
  const { month: rawMonth } = await searchParams;
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today.slice(0, 7);

  // Grille lundi → dimanche couvrant tout le mois.
  const first = `${month}-01`;
  const last = lastDayOfMonth(month);
  const gridFrom = addDays(first, -weekdayIndex(first));
  const gridTo = addDays(last, 6 - weekdayIndex(last));
  const agendaFrom = addDays(today, -OVERDUE_DAYS);
  const agendaTo = addDays(today, UPCOMING_DAYS);
  const from = gridFrom < agendaFrom ? gridFrom : agendaFrom;
  const to = gridTo > agendaTo ? gridTo : agendaTo;

  const tasks = await db.calendarTask.findMany({
    orderBy: [{ time: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      notes: true,
      startDate: true,
      time: true,
      recurrence: true,
      interval: true,
      endDate: true,
      remindDaysBefore: true,
      preset: true,
    },
  });
  const urssaf = tasks.find((t) => t.preset === "URSSAF");
  const tva = tasks.find((t) => t.preset === "TVA");
  const fiscalRef = urssaf ?? tva;
  const fiscal = {
    URSSAF: fiscalPeriodOf(urssaf),
    TVA: fiscalPeriodOf(tva),
    // Rappel commun aux deux ; 1 semaine avant par défaut.
    remindDaysBefore: fiscalRef ? fiscalRef.remindDaysBefore : 7,
  };
  const states = await db.calendarOccurrence.findMany({
    where: { date: { gte: from, lte: to }, doneAt: { not: null } },
    select: { taskId: true, date: true },
  });
  const done = new Set(states.map((s) => `${s.taskId}:${s.date}`));

  const entries: CalendarEntry[] = tasks
    .flatMap((task) =>
      occurrencesBetween(task, from, to).map((date) => ({
        taskId: task.id,
        date,
        done: done.has(`${task.id}:${date}`),
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const days: string[] = [];
  for (let d = gridFrom; d <= gridTo; d = addDays(d, 1)) days.push(d);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Échéances et tâches ponctuelles ou récurrentes (déclarations URSSAF, TVA, maintenance…), avec rappel push + email.
        </p>
      </div>
      <CalendarView
        month={month}
        today={today}
        days={days}
        tasks={tasks}
        gridEntries={entries.filter((e) => e.date >= gridFrom && e.date <= gridTo)}
        overdue={entries.filter((e) => !e.done && e.date >= agendaFrom && e.date < today)}
        upcoming={entries.filter((e) => e.date >= today && e.date <= agendaTo)}
        fiscal={fiscal}
      />
    </div>
  );
}
