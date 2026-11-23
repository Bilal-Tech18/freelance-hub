"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleComplianceAction } from "@/lib/actions/compliance";
import { Check } from "lucide-react";

/**
 * Échéance cliquable : gris = à faire, vert = fait, liseré rouge = en retard.
 * Un clic bascule l'état (optimiste, revert si le serveur refuse).
 */
export function DeadlinePill({
  deadlineKey,
  label,
  due,
  done,
  overdue,
  muted,
}: {
  deadlineKey: string;
  label: string;
  due?: string;
  done: boolean;
  overdue: boolean;
  muted?: boolean; // échéance future lointaine
}) {
  const [isDone, setIsDone] = useState(done);
  const [, startTransition] = useTransition();

  function toggle() {
    const previous = isDone;
    setIsDone(!previous);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("key", deadlineKey);
      const res = await toggleComplianceAction(undefined, fd);
      if (res?.error) {
        setIsDone(previous);
        toast.error(res.error);
      }
    });
  }

  const tone = isDone
    ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : overdue
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      : muted
        ? "border-border bg-muted/40 text-muted-foreground"
        : "border-border bg-background text-foreground hover:bg-accent";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${tone}`}
      title={isDone ? "Fait — cliquer pour annuler" : "Cliquer quand c'est fait"}
    >
      {isDone && <Check className="size-3.5" />}
      {label}
      {due && !isDone && (
        <span className={overdue ? "font-semibold" : "text-muted-foreground"}>
          · {due}
        </span>
      )}
    </button>
  );
}
