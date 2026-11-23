import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-key";
import { apiError } from "@/lib/api-serializers";
import { itemsSchema } from "@/lib/documents";
import { createDraft } from "@/lib/services/documents";

const DOC_TYPES = ["INVOICE", "QUOTE"] as const;
const DOC_STATUSES = [
  "DRAFT",
  "ISSUED",
  "ACCEPTED",
  "REFUSED",
  "PAID",
  "CANCELLED",
] as const;

function serializeDocument(d: {
  id: string;
  type: string;
  status: string;
  activity: string;
  number: string | null;
  clientId: string;
  client: { name: string };
  projectId: string | null;
  project: { name: string } | null;
  vatRate: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  issueDate: Date | null;
  dueDate: Date | null;
  validUntil: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    activity: d.activity,
    number: d.number,
    client: { id: d.clientId, name: d.client.name },
    project: d.projectId ? { id: d.projectId, name: d.project?.name } : null,
    vatRate: Number(d.vatRate),
    subtotalHt: Number(d.subtotal),
    vatAmount: Number(d.vatAmount),
    totalTtc: Number(d.total),
    issueDate: d.issueDate?.toISOString() ?? null,
    dueDate: d.dueDate?.toISOString() ?? null,
    validUntil: d.validUntil?.toISOString() ?? null,
    paidAt: d.paidAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

/** Liste factures & devis. Clé client : uniquement les documents de son Client. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, ["documents:read"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  if (type && !DOC_TYPES.includes(type as never)) {
    return apiError(422, "INVALID", "type must be INVOICE or QUOTE.");
  }
  if (status && !DOC_STATUSES.includes(status as never)) {
    return apiError(422, "INVALID", `status must be one of ${DOC_STATUSES.join(", ")}.`);
  }

  const documents = await db.document.findMany({
    where: {
      // Isolation multi-tenant : admin => tout ; clé client => son Client
      ...(auth.actor.role === "ADMIN"
        ? {}
        : { clientId: auth.actor.clientId ?? "__none__" }),
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      client: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  return NextResponse.json({ documents: documents.map(serializeDocument) });
}

const createSchema = z.object({
  type: z.enum(DOC_TYPES),
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  activity: z.enum(["SERVICE_BNC", "GOODS"]).optional(),
  vatRate: z.number().min(0).max(100),
  items: itemsSchema,
  notes: z.string().max(2000).optional(),
});

/** Crée un BROUILLON de facture/devis (émission = action manuelle dans l'app). */
export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, ["documents:write"]);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Document creation is admin-only.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID", "Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "INVALID", parsed.error.issues[0].message);
  }

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return apiError(404, "NOT_FOUND", "Client not found.");
  if (parsed.data.projectId) {
    const project = await db.project.findFirst({
      where: { id: parsed.data.projectId, clientId: parsed.data.clientId },
    });
    if (!project) {
      return apiError(404, "NOT_FOUND", "Project not found for this client.");
    }
  }

  const doc = await createDraft({
    type: parsed.data.type,
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId || null,
    activity: parsed.data.activity,
    vatRate: parsed.data.vatRate,
    items: parsed.data.items,
    notes: parsed.data.notes,
  });

  const full = await db.document.findUniqueOrThrow({
    where: { id: doc.id },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true } },
    },
  });
  return NextResponse.json({ document: serializeDocument(full) }, { status: 201 });
}
