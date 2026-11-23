import Link from "next/link";
import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { listTickets, type TicketFilters } from "@/lib/services/tickets";
import { isOverdue } from "@/lib/sla";
import { TicketFiltersBar } from "@/components/tickets/ticket-filters-bar";
import { KanbanBoard, type KanbanTicket } from "@/components/tickets/kanban-board";
import {
  AdminTicketsTable,
  type AdminTicketRow,
} from "@/components/tickets/admin-tickets-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Tickets" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUSES = ["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TYPES = ["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"];
const SORTS = ["createdAt", "dueDate", "priority", "updatedAt"];

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  // Les tickets fermés sont masqués par défaut ; le bouton « Tickets fermés »
  // (closed=true) les affiche seuls.
  const showClosed = sp.closed === "true";

  const filters: TicketFilters = {
    status: showClosed
      ? "CLOSED"
      : STATUSES.includes(sp.status ?? "")
        ? (sp.status as TicketStatus)
        : undefined,
    excludeClosed: !showClosed,
    priority: PRIORITIES.includes(sp.priority ?? "")
      ? (sp.priority as TicketPriority)
      : undefined,
    type: TYPES.includes(sp.type ?? "") ? (sp.type as TicketType) : undefined,
    projectId: sp.project || undefined,
    clientId: sp.client || undefined,
    overdue: sp.overdue === "true",
    sort: SORTS.includes(sp.sort ?? "")
      ? (sp.sort as TicketFilters["sort"])
      : "createdAt",
    order: sp.order === "asc" ? "asc" : "desc",
    limit: 100,
  };

  const [{ tickets }, projects, clients] = await Promise.all([
    listTickets(admin, filters),
    db.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const isKanban = sp.view === "kanban";
  const listParams = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== "view") as [string, string][]
  );
  const kanbanParams = new URLSearchParams(listParams);
  kanbanParams.set("view", "kanban");

  const kanbanTickets: KanbanTicket[] = tickets.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectName: t.project.name,
    clientName: t.project.client.name,
    overdue: isOverdue(t),
    internal: t.internal,
  }));

  const tableRows: AdminTicketRow[] = tickets.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    commentCount: t._count.comments,
    clientProject: `${t.project.client.name} · ${t.project.name}`,
    type: t.type,
    priority: t.priority,
    status: t.status,
    createdAt: dateFmt.format(t.createdAt),
    dueDate: t.dueDate ? dateFmt.format(t.dueDate) : null,
    overdue: isOverdue(t),
    internal: t.internal,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <div className="flex items-center gap-1">
          <Button variant={isKanban ? "ghost" : "secondary"} size="sm" asChild>
            <Link href={`/admin/tickets?${listParams.toString()}`}>Liste</Link>
          </Button>
          <Button variant={isKanban ? "secondary" : "ghost"} size="sm" asChild>
            <Link href={`/admin/tickets?${kanbanParams.toString()}`}>Kanban</Link>
          </Button>
          <Button size="sm" className="ml-2" asChild>
            <Link href="/admin/tickets/new">Nouveau ticket</Link>
          </Button>
        </div>
      </div>
      <TicketFiltersBar projects={projects} clients={clients} />
      {isKanban ? (
        <KanbanBoard initialTickets={kanbanTickets} />
      ) : tickets.length === 0 ? (
        <p className="text-muted-foreground">Aucun ticket pour ces filtres.</p>
      ) : (
        <AdminTicketsTable tickets={tableRows} />
      )}
    </div>
  );
}
