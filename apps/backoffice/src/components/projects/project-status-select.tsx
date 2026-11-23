"use client";

import { useState, useTransition } from "react";
import type { ProjectStatus } from "@prisma/client";
import { toast } from "sonner";
import { updateProjectStatusAction } from "@/lib/actions/clients";
import {
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABELS,
} from "@/components/tickets/badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

const STATUSES: ProjectStatus[] = [
  "ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

/** Badge de statut cliquable : change le statut du projet via un dropdown. */
export function ProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const [current, setCurrent] = useState(status);
  const [, startTransition] = useTransition();

  function setStatus(next: ProjectStatus) {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("status", next);
      const res = await updateProjectStatusAction(undefined, fd);
      if (res?.error) {
        setCurrent(previous);
        toast.error(res.error);
      } else {
        toast.success(`Statut : ${PROJECT_STATUS_LABELS[next]}`);
      }
    });
  }

  return (
    // stopPropagation : le badge vit dans des lignes cliquables (navigation)
    <span onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${PROJECT_STATUS_CLASS[current]}`}
            aria-label="Changer le statut du projet"
          >
            {PROJECT_STATUS_LABELS[current]}
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => setStatus(s)}>
              <span
                className={`mr-2 size-2 rounded-full border ${PROJECT_STATUS_CLASS[s]}`}
              />
              {PROJECT_STATUS_LABELS[s]}
              {s === current && <Check className="ml-auto size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
