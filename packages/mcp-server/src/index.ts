#!/usr/bin/env node
/**
 * Serveur MCP (stdio) pour le back office client.
 * Pur wrapper HTTP de l'API publique /api/v1 — aucun accès direct à la DB.
 *
 * Env requis :
 *   BACKOFFICE_API_URL  ex: https://app.mondomaine.com
 *   BACKOFFICE_API_KEY  clé sk_live_… créée dans /admin/settings/api-keys
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.BACKOFFICE_API_URL ?? "http://localhost:3001";
const API_KEY = process.env.BACKOFFICE_API_KEY;

if (!API_KEY) {
  console.error("BACKOFFICE_API_KEY manquant.");
  process.exit(1);
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}
) {
  const url = new URL(`/api/v1${path}`, API_URL);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`${json?.error?.code ?? "ERROR"}: ${message}`);
  }
  return json;
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(e: unknown) {
  return {
    content: [{ type: "text" as const, text: String(e instanceof Error ? e.message : e) }],
    isError: true,
  };
}

const server = new McpServer({ name: "backoffice", version: "0.1.0" });

const STATUS = z.enum(["NEW", "IN_PROGRESS", "IN_DEV", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"]);
const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const TYPE = z.enum(["BUG", "DESIGN_FEEDBACK", "EVOLUTION", "QUESTION"]);

server.registerTool(
  "list_projects",
  {
    description:
      "Liste tous les projets clients avec leur statut, client et jalons.",
    inputSchema: {},
  },
  async () => {
    try {
      return jsonResult(await api("/projects"));
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "list_tickets",
  {
    description:
      "Liste les tickets (retours clients), filtrable par statut, priorité, type, projet, retard SLA. Triable et paginé.",
    inputSchema: {
      status: STATUS.optional(),
      priority: PRIORITY.optional(),
      type: TYPE.optional(),
      projectId: z.string().optional(),
      overdue: z.boolean().optional().describe("Uniquement les tickets en retard de SLA"),
      sort: z.enum(["createdAt", "dueDate", "priority", "updatedAt"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async (args) => {
    try {
      return jsonResult(
        await api("/tickets", {
          query: {
            status: args.status,
            priority: args.priority,
            type: args.type,
            projectId: args.projectId,
            overdue: args.overdue ? "true" : undefined,
            sort: args.sort,
            order: args.order,
            cursor: args.cursor,
            limit: args.limit?.toString(),
          },
        })
      );
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "get_ticket",
  {
    description:
      "Détail complet d'un ticket : description, pièces jointes, fil de commentaires.",
    inputSchema: { ticketId: z.string() },
  },
  async ({ ticketId }) => {
    try {
      return jsonResult(await api(`/tickets/${ticketId}`));
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "create_ticket",
  {
    description: "Crée un ticket sur un projet.",
    inputSchema: {
      projectId: z.string(),
      title: z.string().min(3).max(200),
      description: z.string().min(1),
      type: TYPE,
      priority: PRIORITY.default("MEDIUM"),
      internal: z
        .boolean()
        .default(false)
        .describe("Ticket interne : invisible pour le client, aucune notification."),
    },
  },
  async (args) => {
    try {
      return jsonResult(await api("/tickets", { method: "POST", body: args }));
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "update_ticket",
  {
    description:
      "Met à jour un ticket : statut (transitions validées côté serveur), priorité, deadline (ISO 8601 ou null), titre.",
    inputSchema: {
      ticketId: z.string(),
      status: STATUS.optional(),
      priority: PRIORITY.optional(),
      dueDate: z.string().datetime().nullable().optional(),
      title: z.string().min(3).max(200).optional(),
    },
  },
  async ({ ticketId, ...body }) => {
    try {
      return jsonResult(await api(`/tickets/${ticketId}`, { method: "PATCH", body }));
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "add_comment",
  {
    description: "Ajoute un commentaire sur un ticket (le client sera notifié par email).",
    inputSchema: { ticketId: z.string(), body: z.string().min(1) },
  },
  async ({ ticketId, body }) => {
    try {
      return jsonResult(
        await api(`/tickets/${ticketId}/comments`, { method: "POST", body: { body } })
      );
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "get_stats",
  {
    description:
      "KPIs du back office : tickets ouverts/en retard, temps moyen de résolution, respect SLA, charge hebdo, répartition par projet.",
    inputSchema: {},
  },
  async () => {
    try {
      return jsonResult(await api("/stats"));
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "get_finance",
  {
    description:
      "Vue financière micro-entreprise (admin) : CA HT déclaré ventilé prestations BNC / ventes de marchandises, mois par mois, URSSAF estimée, net, reste à encaisser, estimations d'impôt. Le CA manuel saisi remplace le suivi de son mois.",
    inputSchema: {
      year: z.number().int().min(2000).max(2100).optional()
        .describe("Année (défaut : année en cours ; le détail mensuel n'existe que pour l'année en cours)"),
    },
  },
  async (args) => {
    try {
      return jsonResult(
        await api("/finance", { query: { year: args.year?.toString() } })
      );
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "list_documents",
  {
    description:
      "Liste les factures et devis (numéro, client, projet, nature BNC/ventes, montants HT/TTC, statut, dates).",
    inputSchema: {
      type: z.enum(["INVOICE", "QUOTE"]).optional(),
      status: z
        .enum(["DRAFT", "ISSUED", "ACCEPTED", "REFUSED", "PAID", "CANCELLED"])
        .optional(),
    },
  },
  async (args) => {
    try {
      return jsonResult(
        await api("/documents", { query: { type: args.type, status: args.status } })
      );
    } catch (e) {
      return errorResult(e);
    }
  }
);

server.registerTool(
  "create_document_draft",
  {
    description:
      "Crée un BROUILLON de facture ou devis (admin). L'émission (numérotation légale) reste une action manuelle dans l'app. quantity × unitPrice = total HT par ligne.",
    inputSchema: {
      type: z.enum(["INVOICE", "QUOTE"]),
      clientId: z.string(),
      projectId: z.string().optional(),
      activity: z
        .enum(["SERVICE_BNC", "GOODS"])
        .optional()
        .describe("Nature : prestations BNC (défaut) ou vente de marchandises"),
      vatRate: z.number().min(0).max(100),
      items: z
        .array(
          z.object({
            description: z.string().min(1),
            quantity: z.number().positive(),
            unitPrice: z.number().min(0).describe("Prix unitaire HT"),
          })
        )
        .min(1),
      notes: z.string().max(2000).optional(),
    },
  },
  async (args) => {
    try {
      return jsonResult(
        await api("/documents", {
          method: "POST",
          body: {
            type: args.type,
            clientId: args.clientId,
            projectId: args.projectId,
            activity: args.activity,
            vatRate: args.vatRate,
            items: args.items,
            notes: args.notes,
          },
        })
      );
    } catch (e) {
      return errorResult(e);
    }
  }
);

await server.connect(new StdioServerTransport());
