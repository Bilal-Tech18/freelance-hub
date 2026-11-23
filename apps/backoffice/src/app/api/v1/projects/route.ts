import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-key";
import { getScopedProjectWhere } from "@/lib/authz";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, ["projects:read"]);
  if (!auth.ok) return auth.response;

  const projects = await db.project.findMany({
    // Isolation multi-tenant : admin => tout ; clé client => son Client uniquement
    where: getScopedProjectWhere(auth.actor),
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      milestones: { orderBy: { order: "asc" } },
      _count: { select: { tickets: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      url: p.url,
      client: p.client,
      ticketCount: p._count.tickets,
      milestones: p.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        dueDate: m.dueDate?.toISOString() ?? null,
        completedAt: m.completedAt?.toISOString() ?? null,
      })),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
