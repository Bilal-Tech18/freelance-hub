import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key";
import {
  apiError,
  handleServiceError,
  serializeTicket,
} from "@/lib/api-serializers";
import { getTicket, updateTicket } from "@/lib/services/tickets";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await authenticateApiKey(request, ["tickets:read"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const t = await getTicket(auth.actor, id);
    return NextResponse.json({
      ticket: {
        ...serializeTicket(t),
        description: t.description,
        attachments: t.attachments.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.filename,
          contentType: a.contentType,
        })),
        comments: t.comments.map((c) => ({
          id: c.id,
          body: c.body,
          author: c.author,
          createdAt: c.createdAt.toISOString(),
          attachments: c.attachments.map((a) => ({
            id: a.id,
            url: a.url,
            filename: a.filename,
            contentType: a.contentType,
          })),
        })),
      },
    });
  } catch (e) {
    return handleServiceError(e);
  }
}

const patchSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  title: z.string().min(3).max(200).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await authenticateApiKey(request, ["tickets:write"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(422, "VALIDATION", "Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION", parsed.error.issues[0].message);
  }

  try {
    const ticket = await updateTicket(auth.actor, id, {
      status: parsed.data.status,
      priority: parsed.data.priority,
      title: parsed.data.title,
      ...(parsed.data.dueDate !== undefined
        ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
        : {}),
    });
    return NextResponse.json({ ticket: serializeTicket(ticket) });
  } catch (e) {
    return handleServiceError(e);
  }
}
