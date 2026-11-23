"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { startTimerAction, stopTimerAction } from "@/lib/actions/time";
import { formatClock } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square } from "lucide-react";

type ProjectOption = { id: string; label: string };
type Running = { id: string; projectId: string; label: string; startedAt: string };

function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-4xl font-semibold tabular-nums">
      {formatClock(now - new Date(startedAt).getTime())}
    </span>
  );
}

export function TimerCard({
  projects,
  running,
}: {
  projects: ProjectOption[];
  running: Running | null;
}) {
  const [projectId, setProjectId] = useState(running?.projectId ?? "");
  const [pending, startTransition] = useTransition();

  function start() {
    if (!projectId) return;
    startTransition(async () => {
      const res = await startTimerAction(projectId);
      if (res?.error) toast.error(res.error);
    });
  }

  function stop() {
    startTransition(async () => {
      await stopTimerAction();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        {running ? (
          <>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                En cours · <span className="font-medium text-foreground">{running.label}</span>
              </p>
              <Elapsed startedAt={running.startedAt} />
            </div>
            <Button
              size="lg"
              variant="destructive"
              onClick={stop}
              disabled={pending}
            >
              <Square className="size-4" /> Arrêter
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-56 flex-1">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un projet…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={start} disabled={pending || !projectId}>
              <Play className="size-4" /> Démarrer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
