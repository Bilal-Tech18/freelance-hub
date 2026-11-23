"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteCalendarTaskAction,
  saveCalendarTaskAction,
  toggleCalendarOccurrenceAction,
} from "@/lib/actions/calendar";
import { addDays, describeRecurrence, RECURRENCE_LABELS, type Recurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Bell, Check, ChevronLeft, ChevronRight, Plus, Repeat, Trash2 } from "lucide-react";
import type { FiscalPeriod } from "@/lib/fiscal-deadlines";
import { FiscalRemindersDialog } from "./fiscal-reminders-dialog";
import { REMINDERS } from "./reminder-options";

export type CalendarTask = {
  id: string;
  title: string;
  notes: string;
  startDate: string;
  time: string | null;
  recurrence: Recurrence;
  interval: number;
  endDate: string | null;
  remindDaysBefore: number | null;
};

export type FiscalSettings = { URSSAF: FiscalPeriod; TVA: FiscalPeriod; remindDaysBefore: number | null };

export type CalendarEntry = { taskId: string; date: string; done: boolean };

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_CHIPS = 3;
const MAX_UPCOMING = 12;

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

type Editing = { task: CalendarTask | null; date: string } | null;

export function CalendarView({
  month,
  today,
  days,
  tasks,
  gridEntries,
  overdue,
  upcoming,
  fiscal,
}: {
  month: string;
  today: string;
  days: string[];
  tasks: CalendarTask[];
  gridEntries: CalendarEntry[];
  overdue: CalendarEntry[];
  upcoming: CalendarEntry[];
  fiscal: FiscalSettings;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [, startTransition] = useTransition();
  // Coches optimistes, partagées entre la grille et l'agenda.
  const [toggled, setToggled] = useOptimistic(
    new Map<string, boolean>(),
    (map, { key, done }: { key: string; done: boolean }) => new Map(map).set(key, done)
  );
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const isDone = (e: CalendarEntry) => toggled.get(`${e.taskId}:${e.date}`) ?? e.done;

  function toggle(entry: CalendarEntry, done: boolean) {
    startTransition(async () => {
      setToggled({ key: `${entry.taskId}:${entry.date}`, done });
      const res = await toggleCalendarOccurrenceAction(entry.taskId, entry.date, done);
      if (res?.error) toast.error(res.error);
    });
  }

  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of gridEntries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const visibleOverdue = overdue.filter((e) => !isDone(e));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold capitalize">
            {monthFmt.format(asDate(`${month}-01`))}
          </h2>
          <Button variant="outline" size="icon-sm" asChild aria-label="Mois précédent">
            <Link href={`?month=${shiftMonth(month, -1)}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="?">Aujourd&apos;hui</Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild aria-label="Mois suivant">
            <Link href={`?month=${shiftMonth(month, 1)}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <FiscalRemindersDialog current={fiscal} />
          <Button size="sm" onClick={() => setEditing({ task: null, date: today })}>
            <Plus data-icon="inline-start" className="size-4" />
            Nouvelle tâche
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const entries = byDay.get(day) ?? [];
              const outside = !day.startsWith(month);
              return (
                <div
                  key={day}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing({ task: null, date: day })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditing({ task: null, date: day });
                  }}
                  className={cn(
                    "group min-h-16 cursor-pointer border-b border-r border-border/60 p-1 text-left transition-colors hover:bg-accent/40 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                    outside && "bg-muted/30 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        day === today && "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <Plus className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  {/* Mobile : pastilles ; desktop : libellés. */}
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    {entries.map((e) => (
                      <span
                        key={e.taskId}
                        className={cn(
                          "size-1.5 rounded-full",
                          isDone(e) ? "bg-muted-foreground/40" : "bg-primary"
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {entries.slice(0, MAX_CHIPS).map((e) => {
                      const task = taskById.get(e.taskId)!;
                      return (
                        <button
                          key={e.taskId}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setEditing({ task, date: e.date });
                          }}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-4 transition-colors",
                            isDone(e)
                              ? "bg-muted text-muted-foreground line-through"
                              : day < today
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "bg-primary/10 text-foreground hover:bg-primary/20"
                          )}
                        >
                          {task.recurrence !== "NONE" && <Repeat className="size-3 shrink-0 opacity-60" />}
                          {task.time && <span className="shrink-0 tabular-nums opacity-70">{task.time}</span>}
                          <span className="truncate">{task.title}</span>
                        </button>
                      );
                    })}
                    {entries.length > MAX_CHIPS && (
                      <div className="px-1.5 text-[11px] text-muted-foreground">
                        +{entries.length - MAX_CHIPS} autre{entries.length - MAX_CHIPS > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        {visibleOverdue.length > 0 && (
          <AgendaList
            title="En retard"
            tone="danger"
            entries={visibleOverdue}
            taskById={taskById}
            isDone={isDone}
            onToggle={toggle}
            onOpen={(task, date) => setEditing({ task, date })}
          />
        )}
        <AgendaList
          title="À venir (30 j)"
          entries={upcoming.slice(0, MAX_UPCOMING)}
          taskById={taskById}
          isDone={isDone}
          onToggle={toggle}
          onOpen={(task, date) => setEditing({ task, date })}
          today={today}
          empty="Rien de prévu. Ajoutez une tâche depuis le calendrier."
        />
      </aside>

      {editing && (
        <TaskDialog
          key={`${editing.task?.id ?? "new"}:${editing.date}`}
          editing={editing}
          entry={
            editing.task
              ? [...gridEntries, ...overdue, ...upcoming].find(
                  (e) => e.taskId === editing.task!.id && e.date === editing.date
                )
              : undefined
          }
          isDone={isDone}
          onToggle={toggle}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AgendaList({
  title,
  tone,
  entries,
  taskById,
  isDone,
  onToggle,
  onOpen,
  today,
  empty,
}: {
  title: string;
  tone?: "danger";
  entries: CalendarEntry[];
  taskById: Map<string, CalendarTask>;
  isDone: (e: CalendarEntry) => boolean;
  onToggle: (e: CalendarEntry, done: boolean) => void;
  onOpen: (task: CalendarTask, date: string) => void;
  today?: string;
  empty?: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className={cn("text-sm font-medium", tone === "danger" ? "text-destructive" : "text-muted-foreground")}>
        {title}
      </h3>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          {entries.map((e) => {
            const task = taskById.get(e.taskId)!;
            const done = isDone(e);
            return (
              <li
                key={`${e.taskId}:${e.date}`}
                className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => onToggle(e, !done)}
                  aria-label={done ? "Marquer à faire" : "Marquer terminée"}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"
                  )}
                >
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </button>
                <button type="button" onClick={() => onOpen(task, e.date)} className="min-w-0 flex-1 text-left">
                  <div className={cn("truncate text-sm", done && "text-muted-foreground line-through")}>
                    {task.title}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs text-muted-foreground",
                      tone === "danger" && "text-destructive/80"
                    )}
                  >
                    <span className="capitalize">
                      {e.date === today ? "Aujourd'hui" : dayFmt.format(asDate(e.date))}
                    </span>
                    {task.time && <span>· {task.time}</span>}
                    {task.recurrence !== "NONE" && <Repeat className="ml-1 size-3" />}
                    {task.remindDaysBefore !== null && <Bell className="size-3" />}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TaskDialog({
  editing,
  entry,
  isDone,
  onToggle,
  onClose,
}: {
  editing: NonNullable<Editing>;
  entry: CalendarEntry | undefined;
  isDone: (e: CalendarEntry) => boolean;
  onToggle: (e: CalendarEntry, done: boolean) => void;
  onClose: () => void;
}) {
  const task = editing.task;
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [startDate, setStartDate] = useState(task?.startDate ?? editing.date);
  const [time, setTime] = useState(task?.time ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? "NONE");
  const [interval, setIntervalValue] = useState(String(task?.interval ?? 1));
  const [endDate, setEndDate] = useState(task?.endDate ?? "");
  const [remind, setRemind] = useState(
    task ? (task.remindDaysBefore === null ? "none" : String(task.remindDaysBefore)) : "0"
  );
  const reminderOptions = REMINDERS.some((r) => r.value === remind)
    ? REMINDERS
    : [...REMINDERS, { value: remind, label: `${remind} jours avant` }];

  function save() {
    startTransition(async () => {
      const res = await saveCalendarTaskAction(task?.id ?? null, {
        title,
        notes,
        startDate,
        time: time || null,
        recurrence,
        interval: Number(interval) || 1,
        endDate: endDate || null,
        remindDaysBefore: remind === "none" ? null : Number(remind),
      });
      if (res?.error) return void toast.error(res.error);
      toast.success(task ? "Tâche modifiée" : "Tâche ajoutée");
      onClose();
    });
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    startTransition(async () => {
      await deleteCalendarTaskAction(task!.id);
      toast.success("Tâche supprimée");
      onClose();
    });
  }

  const done = entry ? isDone(entry) : false;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          <DialogDescription>
            {task
              ? `${describeRecurrence(task.recurrence, task.interval)} · occurrence du ${longDayFmt.format(asDate(editing.date))}`
              : "Ponctuelle ou récurrente, avec un rappel push + email si besoin."}
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <Button
            type="button"
            variant={done ? "secondary" : "outline"}
            onClick={() => onToggle(entry, !done)}
            className="justify-start"
          >
            <Check className="size-4" />
            {done ? "Faite — marquer à faire" : "Marquer cette occurrence comme faite"}
          </Button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Maintenance serveur client X"
              maxLength={200}
              required
              autoFocus={!task}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-date">{recurrence === "NONE" ? "Date" : "Première occurrence"}</Label>
              <Input
                id="task-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-time">Heure (optionnelle)</Label>
              <Input id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Répétition</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r].one}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Rappel</Label>
              <Select value={remind} onValueChange={setRemind}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reminderOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {recurrence !== "NONE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="task-interval">Tous les… {RECURRENCE_LABELS[recurrence].many}</Label>
                <Input
                  id="task-interval"
                  type="number"
                  min={1}
                  max={365}
                  value={interval}
                  onChange={(e) => setIntervalValue(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-end">Jusqu&apos;au (optionnel)</Label>
                <Input
                  id="task-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {remind !== "none" && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Push + email {remind === "0" ? "le jour même" : `${remind} j avant (le ${dayFmt.format(asDate(addDays(startDate || editing.date, -Number(remind))))} pour la 1ʳᵉ)`}
              , à {time || "9:00"}.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Checklist, accès, liens…"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {task ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                disabled={pending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {confirmDelete
                  ? "Confirmer la suppression"
                  : `Supprimer${task.recurrence !== "NONE" ? " la série" : ""}`}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {task ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
