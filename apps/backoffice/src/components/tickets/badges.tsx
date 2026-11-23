import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import type { ProjectStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/ticket-labels";

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_CLASS: Record<TicketStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  IN_PROGRESS:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  IN_DEV:
    "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  WAITING_ON_CLIENT:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  RESOLVED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  CLOSED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
};

export const STATUS_DOT: Record<TicketStatus, string> = {
  NEW: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  IN_DEV: "bg-cyan-500",
  WAITING_ON_CLIENT: "bg-violet-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-zinc-400",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Pill className={STATUS_CLASS[status]}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </Pill>
  );
}

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  LOW: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
  MEDIUM:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  URGENT:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Pill className={PRIORITY_CLASS[priority]}>{PRIORITY_LABELS[priority]}</Pill>;
}

const TYPE_CLASS: Record<TicketType, string> = {
  BUG: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  DESIGN_FEEDBACK:
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  EVOLUTION:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  QUESTION:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
};

export function TypeBadge({ type }: { type: TicketType }) {
  return <Pill className={TYPE_CLASS[type]}>{TYPE_LABELS[type]}</Pill>;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Terminé",
  ARCHIVED: "Archivé",
};

export const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  ONBOARDING:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  ACTIVE:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  PAUSED:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  COMPLETED:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  ARCHIVED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Pill className={PROJECT_STATUS_CLASS[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Pill>
  );
}

export function InternalBadge() {
  return (
    <Pill className="bg-slate-100 text-slate-600 border-slate-300 border-dashed dark:bg-slate-900 dark:text-slate-400 dark:border-slate-600">
      Interne
    </Pill>
  );
}

export function OverdueBadge() {
  return (
    <Pill className="bg-red-600 text-white border-red-600 dark:bg-red-700 dark:border-red-700">
      En retard
    </Pill>
  );
}
