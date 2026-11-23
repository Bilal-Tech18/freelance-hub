"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProjectProgressAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";

/**
 * Avancement du projet : automatique (calculé depuis les jalons) ou manuel
 * via le curseur. Bouger le curseur passe en manuel ; "Auto" revient au calcul.
 */
export function ProjectProgressControl({
  projectId,
  computed,
  override,
}: {
  projectId: string;
  computed: number;
  override: number | null;
}) {
  const [manual, setManual] = useState<number | null>(override);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const value = dragValue ?? manual ?? computed;
  const isManual = manual != null;

  function save(progress: number | null) {
    const previous = manual;
    setManual(progress);
    setDragValue(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("progress", progress == null ? "" : String(progress));
      const res = await updateProjectProgressAction(undefined, fd);
      if (res?.error) {
        setManual(previous);
        toast.error(res.error);
      } else {
        toast.success(
          progress == null
            ? "Avancement recalculé depuis les jalons"
            : `Avancement : ${progress}%`
        );
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Avancement{" "}
          <span className="text-xs">
            ({isManual ? "manuel" : "auto — jalons"})
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{value}%</span>
          {isManual && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => save(null)}
            >
              Auto
            </Button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label="Avancement du projet"
        className="w-full accent-primary"
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerUp={(e) => save(Number(e.currentTarget.value))}
        onKeyUp={(e) => {
          if (dragValue != null) save(Number(e.currentTarget.value));
        }}
      />
    </div>
  );
}
