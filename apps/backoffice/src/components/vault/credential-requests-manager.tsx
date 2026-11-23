"use client";

import { useActionState } from "react";
import {
  addCredentialRequestAction,
  deleteCredentialRequestAction,
} from "@/lib/actions/credentials";
import { PROVIDER_LIST, providerLabel } from "@/lib/credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

type Request = {
  id: string;
  provider: string;
  label: string;
  required: boolean;
  status: "PENDING" | "PROVIDED" | "SKIPPED";
};

const STATUS: Record<Request["status"], { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-muted text-muted-foreground" },
  PROVIDED: {
    label: "Fourni",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  SKIPPED: {
    label: "Passé",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

function DeleteButton({ id }: { id: string }) {
  const [, action] = useActionState(deleteCredentialRequestAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        aria-label="Supprimer"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}

export function CredentialRequestsManager({
  projectId,
  requests,
}: {
  projectId: string;
  requests: Request[];
}) {
  const [state, action, pending] = useActionState(addCredentialRequestAction, undefined);

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{r.label}</span>{" "}
                <span className="text-muted-foreground">· {providerLabel(r.provider)}</span>
                {!r.required && (
                  <span className="text-muted-foreground"> · optionnel</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS[r.status].cls}`}>
                  {STATUS[r.status].label}
                </span>
                <DeleteButton id={r.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end border-t pt-4">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid gap-1.5">
          <Label>Service</Label>
          <Select name="provider" defaultValue="RENDER">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_LIST.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cr-label">Intitulé demandé au client</Label>
          <Input id="cr-label" name="label" placeholder="Ex : Accès au compte Render" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Demander"}
        </Button>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="required" defaultChecked className="rounded border-input" />
          Accès requis
        </label>
        {state?.error && (
          <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>
        )}
      </form>
    </div>
  );
}
