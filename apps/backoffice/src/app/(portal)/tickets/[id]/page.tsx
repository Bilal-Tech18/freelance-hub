import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getTicket, TicketError } from "@/lib/services/tickets";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { CommentForm } from "@/components/tickets/comment-form";
import { ClientTicketActions } from "@/components/tickets/client-ticket-actions";
import { EditTicketDialog } from "@/components/tickets/edit-ticket-dialog";
import { TicketStatusHistory } from "@/components/tickets/ticket-status-history";
import {
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/tickets/badges";
import { BackButton } from "@/components/nav/back-button";

export default async function ClientTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  let ticket;
  try {
    ticket = await getTicket(user, id);
  } catch (e) {
    if (e instanceof TicketError) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <BackButton href="/tickets" label="Mes tickets" />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">
            <span className="text-muted-foreground">#{ticket.number}</span>{" "}
            {ticket.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <TypeBadge type={ticket.type} />
          <span className="text-sm text-muted-foreground">
            {ticket.project.name}
          </span>
        </div>
      </div>

      {/* Modifiable par son auteur tant que le ticket n'a pas été pris en charge */}
      {ticket.status === "NEW" && ticket.createdBy.id === user.id && (
        <div>
          <EditTicketDialog
            ticket={{
              id: ticket.id,
              title: ticket.title,
              description: ticket.description,
              type: ticket.type,
              priority: ticket.priority,
            }}
          />
        </div>
      )}

      <ClientTicketActions ticketId={ticket.id} status={ticket.status} />

      <TicketThread
        description={ticket.description}
        authorName={ticket.createdBy.name}
        createdAt={ticket.createdAt}
        ticketAttachments={ticket.attachments}
        comments={ticket.comments}
      />

      {ticket.status !== "CLOSED" && <CommentForm ticketId={ticket.id} />}

      <TicketStatusHistory
        changes={ticket.statusChanges}
        createdAt={ticket.createdAt}
        creatorName={ticket.createdBy.name}
      />
    </div>
  );
}
