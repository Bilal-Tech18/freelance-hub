import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key";
import {
  apiError,
  handleServiceError,
  serializeTicket,
} from "@/lib/api-serializers";
import {
  createTicket,
  listTickets,
  type TicketFilters,
} from "@/lib/services/tickets";

const listSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  type: z.enum(["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"]).optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  overdue: z.enum(["true", "false"]).optional(),
  sort: z.enum(["createdAt", "dueDate", "priority", "updatedAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, ["tickets:read"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return apiError(422, "VALIDATION", parsed.error.issues[0].message);
  }

  const filters: TicketFilters = {
    ...parsed.data,
    overdue: parsed.data.overdue === "true",
  };

  try {
    const { tickets, nextCursor } = await listTickets(auth.actor, filters);
    return NextResponse.json({
      tickets: tickets.map(serializeTicket),
      nextCursor,
    });
  } catch (e) {
    return handleServiceError(e);
  }
}

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(10000),
  type: z.enum(["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  // Ticket interne (clé API admin uniquement — le service rejette sinon).
  internal: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, ["tickets:write"]);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(422, "VALIDATION", "Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION", parsed.error.issues[0].message);
  }

  try {
    const ticket = await createTicket(auth.actor, parsed.data);
    return NextResponse.json({ ticket: serializeTicket(ticket) }, { status: 201 });
  } catch (e) {
    return handleServiceError(e);
  }
}
