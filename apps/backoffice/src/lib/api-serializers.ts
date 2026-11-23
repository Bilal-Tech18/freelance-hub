import "server-only";

import { NextResponse } from "next/server";
import { TicketError } from "@/lib/services/tickets";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleServiceError(e: unknown) {
  if (e instanceof TicketError) {
    const status =
      e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 422;
    return apiError(status, e.code, e.message);
  }
  console.error("[api/v1]", e);
  return apiError(500, "INTERNAL", "Internal server error.");
}

type TicketWithRelations = {
  id: string;
  number: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  internal: boolean;
  dueDate: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  project: { name: string; client: { id: string; name: string } };
  createdBy: { id: string; name: string };
};

export function serializeTicket(t: TicketWithRelations) {
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    type: t.type,
    priority: t.priority,
    status: t.status,
    internal: t.internal,
    dueDate: t.dueDate?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    closedAt: t.closedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    project: {
      id: t.projectId,
      name: t.project.name,
      client: t.project.client,
    },
    createdBy: t.createdBy,
  };
}
