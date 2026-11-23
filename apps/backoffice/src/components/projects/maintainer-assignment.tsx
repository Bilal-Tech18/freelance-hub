"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { assignProjectAction } from "@/lib/actions/maintenance";
import { Checkbox } from "@/components/ui/checkbox";

export type MaintainerRow = {
  id: string;
  name: string;
  email: string;
  assigned: boolean;
};

/** Assigne le projet aux comptes mainteneurs (toggle par personne). */
export function MaintainerAssignment({
  projectId,
  maintainers,
}: {
  projectId: string;
  maintainers: MaintainerRow[];
}) {
  const [rows, setOptimistic] = useOptimistic(
    maintainers,
    (state, { id, assigned }: { id: string; assigned: boolean }) =>
      state.map((m) => (m.id === id ? { ...m, assigned } : m))
  );
  const [, startTransition] = useTransition();

  function toggle(id: string, assigned: boolean) {
    startTransition(async () => {
      setOptimistic({ id, assigned });
      const res = await assignProjectAction({ projectId, userId: id, assigned });
      if (res?.error) toast.error(res.error);
    });
  }

  if (maintainers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun compte mainteneur pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((m) => (
        <label
          key={m.id}
          className="flex cursor-pointer items-center gap-2.5 text-sm"
        >
          <Checkbox
            checked={m.assigned}
            onCheckedChange={(v) => toggle(m.id, v === true)}
          />
          <span>
            {m.name}{" "}
            <span className="text-muted-foreground">· {m.email}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
