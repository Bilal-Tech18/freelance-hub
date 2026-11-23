"use server";

import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatEUR } from "@/lib/finance";

export type SearchResult = {
  group: "Clients" | "Projets" | "Tickets" | "Documents";
  label: string;
  sub: string;
  href: string;
};

/**
 * Recherche globale admin : clients, projets, tickets (titre ou #numéro)
 * et documents (numéro ou client). 5 résultats max par groupe.
 */
export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const ticketNumber = /^#?(\d+)$/.exec(q)?.[1];

  const [clients, projects, tickets, documents] = await Promise.all([
    db.client.findMany({
      where: {
        OR: [{ name: contains }, { legalName: contains }, { contactEmail: contains }],
      },
      select: { id: true, name: true, contactEmail: true },
      orderBy: { name: "asc" },
      take: 5,
    }),
    db.project.findMany({
      where: { name: contains },
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 5,
    }),
    db.ticket.findMany({
      where: ticketNumber
        ? { number: Number(ticketNumber) }
        : { title: contains },
      select: {
        id: true,
        number: true,
        title: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.document.findMany({
      where: { OR: [{ number: contains }, { client: { name: contains } }] },
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        total: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return [
    ...clients.map(
      (c): SearchResult => ({
        group: "Clients",
        label: c.name,
        sub: c.contactEmail ?? "",
        href: `/admin/clients/${c.id}`,
      })
    ),
    ...projects.map(
      (p): SearchResult => ({
        group: "Projets",
        label: p.name,
        sub: p.client.name,
        href: `/admin/projects/${p.id}`,
      })
    ),
    ...tickets.map(
      (t): SearchResult => ({
        group: "Tickets",
        label: `#${t.number} ${t.title}`,
        sub: t.project.name,
        href: `/admin/tickets/${t.id}`,
      })
    ),
    ...documents.map(
      (d): SearchResult => ({
        group: "Documents",
        label: `${d.number ?? "Brouillon"} · ${d.type === "QUOTE" ? "Devis" : "Facture"}`,
        sub: `${d.client.name} · ${formatEUR(Number(d.total))} TTC`,
        href: `/admin/documents/${d.id}`,
      })
    ),
  ];
}
