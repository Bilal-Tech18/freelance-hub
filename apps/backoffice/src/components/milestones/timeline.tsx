import type { Milestone } from "@prisma/client";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function computeProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const score = milestones.reduce(
    (sum, m) =>
      sum + (m.status === "DONE" ? 1 : m.status === "IN_PROGRESS" ? 0.5 : 0),
    0
  );
  return Math.round((score / milestones.length) * 100);
}

export function MilestoneTimeline({
  milestones,
  progressOverride = null,
}: {
  milestones: Milestone[];
  progressOverride?: number | null;
}) {
  if (milestones.length === 0 && progressOverride == null) {
    return (
      <p className="text-sm text-muted-foreground">
        La timeline du projet sera bientôt disponible.
      </p>
    );
  }

  const progress = progressOverride ?? computeProgress(milestones);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avancement</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ol className="space-y-3">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-start gap-3">
            {m.status === "DONE" ? (
              <CheckCircle2 className="size-5 text-primary mt-0.5" />
            ) : m.status === "IN_PROGRESS" ? (
              <CircleDot className="size-5 text-primary mt-0.5" />
            ) : (
              <Circle className="size-5 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  m.status === "DONE" ? "text-muted-foreground line-through" : ""
                }`}
              >
                {m.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.status === "DONE" && m.completedAt
                  ? `Terminé le ${dateFmt.format(m.completedAt)}`
                  : m.dueDate
                    ? `Prévu pour le ${dateFmt.format(m.dueDate)}`
                    : m.status === "IN_PROGRESS"
                      ? "En cours"
                      : "À venir"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
