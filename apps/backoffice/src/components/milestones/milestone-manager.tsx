"use client";

import { useActionState } from "react";
import type { Milestone, MilestoneStatus } from "@prisma/client";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneDueDateAction,
  updateMilestoneStatusAction,
} from "@/lib/actions/milestones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  PLANNED: "Prévu",
  IN_PROGRESS: "En cours",
  DONE: "Terminé",
};

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const [, statusAction] = useActionState(updateMilestoneStatusAction, undefined);
  const [, dueDateAction] = useActionState(updateMilestoneDueDateAction, undefined);
  const [, deleteAction] = useActionState(deleteMilestoneAction, undefined);

  return (
    <li className="flex items-center gap-2">
      <span className="flex-1 text-sm font-medium">{milestone.title}</span>
      <form action={dueDateAction}>
        <input type="hidden" name="milestoneId" value={milestone.id} />
        <Input
          type="date"
          name="dueDate"
          defaultValue={
            milestone.dueDate
              ? new Date(milestone.dueDate).toISOString().slice(0, 10)
              : ""
          }
          className="w-40"
          aria-label={`Date prévue pour ${milestone.title}`}
          onChange={(e) => {
            const form = new FormData();
            form.set("milestoneId", milestone.id);
            form.set("dueDate", e.target.value);
            dueDateAction(form);
          }}
        />
      </form>
      <form action={statusAction}>
        <input type="hidden" name="milestoneId" value={milestone.id} />
        <Select
          name="status"
          defaultValue={milestone.status}
          onValueChange={(v) => {
            const form = new FormData();
            form.set("milestoneId", milestone.id);
            form.set("status", v);
            statusAction(form);
          }}
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="milestoneId" value={milestone.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Supprimer ${milestone.title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </form>
    </li>
  );
}

export function MilestoneManager({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: Milestone[];
}) {
  const [createState, createAction, creating] = useActionState(
    createMilestoneAction,
    undefined
  );

  return (
    <div className="space-y-4">
      {milestones.length > 0 && (
        <ul className="space-y-2">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} />
          ))}
        </ul>
      )}
      <form action={createAction} className="flex gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <Input name="title" placeholder="Nouveau jalon (ex: Maquettes validées)" required />
        <Input name="dueDate" type="date" className="w-40" />
        <Button type="submit" disabled={creating}>
          Ajouter
        </Button>
      </form>
      {createState?.error && (
        <p className="text-sm text-destructive">{createState.error}</p>
      )}
    </div>
  );
}
