"use client";

import { useActionState } from "react";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { updateTicketAction } from "@/lib/actions/tickets";
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
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/ticket-labels";

export function AdminTicketControls({
  ticketId,
  status,
  priority,
  dueDate,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null; // yyyy-MM-dd
}) {
  const [state, formAction, pending] = useActionState(updateTicketAction, undefined);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="grid gap-2">
        <Label>Statut</Label>
        <Select name="status" defaultValue={status}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Priorité</Label>
        <Select name="priority" defaultValue={priority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dueDate">Deadline de correction</Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={dueDate ?? ""}
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Mise à jour…" : "Mettre à jour"}
      </Button>
    </form>
  );
}
