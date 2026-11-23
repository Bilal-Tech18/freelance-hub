"use client";

import { useState, useTransition } from "react";
import type { TicketStatus } from "@prisma/client";
import { toast } from "sonner";
import { updateTicketAction } from "@/lib/actions/tickets";
import { STATUS_CLASS, STATUS_DOT } from "@/components/tickets/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";

/**
 * Select compact (aspect badge) pour changer le statut directement depuis
 * une ligne du tableau. Optimiste : revert + toast si le serveur refuse.
 */
export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const [value, setValue] = useState<TicketStatus>(status);
  const [pending, startTransition] = useTransition();

  function onChange(next: TicketStatus) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("ticketId", ticketId);
      formData.set("status", next);
      const result = await updateTicketAction(undefined, formData);
      if (result?.error) {
        setValue(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    // stopPropagation : la ligne du tableau est cliquable (navigation).
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={(v) => onChange(v as TicketStatus)}>
        <SelectTrigger
          size="sm"
          disabled={pending}
          className={cn(
            "h-auto gap-1 rounded-full border py-0.5 pl-2 pr-1.5 text-xs font-medium shadow-none data-[size=sm]:h-auto data-[size=sm]:rounded-full dark:bg-transparent [&_svg:not([class*='size-'])]:size-3",
            STATUS_CLASS[value]
          )}
        >
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[value])} />
          {STATUS_LABELS[value]}
        </SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={4}>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              <span className={cn("size-1.5 rounded-full", STATUS_DOT[s])} />
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
