"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { toast } from "sonner";
import { updateTicketAction } from "@/lib/actions/tickets";
import { InternalBadge, OverdueBadge, PriorityBadge } from "@/components/tickets/badges";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/ticket-labels";

const PRIORITY_BORDER: Record<string, string> = {
  LOW: "border-l-zinc-300",
  MEDIUM: "border-l-sky-400",
  HIGH: "border-l-orange-400",
  URGENT: "border-l-red-500",
};

const COLUMN_ACCENT: Record<string, string> = {
  NEW: "border-t-blue-400",
  IN_PROGRESS: "border-t-amber-400",
  IN_DEV: "border-t-cyan-400",
  WAITING_ON_CLIENT: "border-t-violet-400",
  RESOLVED: "border-t-emerald-400",
  CLOSED: "border-t-zinc-300",
};

export type KanbanTicket = {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  projectName: string;
  clientName: string;
  overdue: boolean;
  internal: boolean;
};

function TicketCard({
  ticket,
  dragging,
  basePath,
}: {
  ticket: KanbanTicket;
  dragging?: boolean;
  basePath: string;
}) {
  return (
    <Card
      className={`border-l-4 bg-background ${PRIORITY_BORDER[ticket.priority]} ${
        dragging ? "shadow-xl ring-1 ring-ring/30" : ""
      }`}
    >
      <CardContent className="p-3 space-y-2">
        <Link
          href={`${basePath}/${ticket.id}`}
          className="block text-sm font-medium hover:underline"
          onClick={(e) => dragging && e.preventDefault()}
        >
          <span className="text-muted-foreground">#{ticket.number}</span>{" "}
          {ticket.title}
        </Link>
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={ticket.priority} />
          {ticket.internal && <InternalBadge />}
          {ticket.overdue && <OverdueBadge />}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {ticket.clientName} · {ticket.projectName}
        </p>
      </CardContent>
    </Card>
  );
}

function DraggableCard({
  ticket,
  basePath,
}: {
  ticket: KanbanTicket;
  basePath: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // La carte suit le pointeur via sa propre translation : pas d'overlay,
      // donc pas de décalage possible entre la carte et la souris.
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? "relative z-50" : ""
      }`}
    >
      <TicketCard ticket={ticket} dragging={isDragging} basePath={basePath} />
    </div>
  );
}

function Column({
  status,
  tickets,
  basePath,
}: {
  status: TicketStatus;
  tickets: KanbanTicket[];
  basePath: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border border-t-4 bg-muted/30 p-2 min-h-[200px] ${
        COLUMN_ACCENT[status]
      } ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{tickets.length}</span>
      </div>
      {tickets.map((t) => (
        <DraggableCard key={t.id} ticket={t} basePath={basePath} />
      ))}
    </div>
  );
}

export function KanbanBoard({
  initialTickets,
  basePath = "/admin/tickets",
}: {
  initialTickets: KanbanTicket[];
  /** Préfixe des liens de détail (ex. /maintenance/tickets). */
  basePath?: string;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const ticketId = String(active.id);
    const newStatus = String(over.id) as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    const previous = tickets;
    // Optimiste : on déplace tout de suite, on revert si le serveur refuse.
    setTickets((ts) =>
      ts.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );
    startTransition(async () => {
      const formData = new FormData();
      formData.set("ticketId", ticketId);
      formData.set("status", newStatus);
      const result = await updateTicketAction(undefined, formData);
      if (result?.error) {
        setTickets(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6 items-start">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={tickets.filter((t) => t.status === status)}
            basePath={basePath}
          />
        ))}
      </div>
    </DndContext>
  );
}
