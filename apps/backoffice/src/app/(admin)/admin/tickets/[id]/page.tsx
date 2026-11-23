import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getTicket, TicketError } from "@/lib/services/tickets";
import { isOverdue } from "@/lib/sla";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { CommentForm } from "@/components/tickets/comment-form";
import { AdminTicketControls } from "@/components/tickets/admin-ticket-controls";
import { TicketStatusHistory } from "@/components/tickets/ticket-status-history";
import { TicketRevisionHistory } from "@/components/tickets/ticket-revision-history";
import {
  InternalBadge,
  OverdueBadge,
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/tickets/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/nav/back-button";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  let ticket;
  try {
    ticket = await getTicket(admin, id);
  } catch (e) {
    if (e instanceof TicketError) notFound();
    throw e;
  }

  const overdue = isOverdue(ticket);

  return (
    <div className="space-y-6">
      <BackButton href="/admin/tickets" label="Tickets" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          <span className="text-muted-foreground">#{ticket.number}</span>{" "}
          {ticket.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <TypeBadge type={ticket.type} />
          {ticket.internal && <InternalBadge />}
          {overdue && <OverdueBadge />}
          <span className="text-muted-foreground">
            <Link
              href={`/admin/projects/${ticket.projectId}`}
              className="hover:underline"
            >
              {ticket.project.name}
            </Link>{" "}
            · {ticket.project.client.name} · par {ticket.createdBy.name}
          </span>
          {ticket.dueDate && (
            <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
              · deadline {dateFmt.format(ticket.dueDate)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <TicketThread
            description={ticket.description}
            authorName={ticket.createdBy.name}
            createdAt={ticket.createdAt}
            ticketAttachments={ticket.attachments}
            comments={ticket.comments}
          />
          <CommentForm ticketId={ticket.id} />
        </div>
        <div className="space-y-6 h-fit">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gestion</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTicketControls
              // Remount après revalidation : le reset de formulaire post-action
              // ramènerait sinon les selects non contrôlés à l'ancien defaultValue.
              key={`${ticket.status}-${ticket.priority}-${ticket.dueDate?.getTime() ?? ""}`}
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              dueDate={
                ticket.dueDate ? ticket.dueDate.toISOString().slice(0, 10) : null
              }
            />
          </CardContent>
        </Card>
        <TicketStatusHistory
          changes={ticket.statusChanges}
          createdAt={ticket.createdAt}
          creatorName={ticket.createdBy.name}
        />
        <TicketRevisionHistory revisions={ticket.revisions} />
        </div>
      </div>
    </div>
  );
}
