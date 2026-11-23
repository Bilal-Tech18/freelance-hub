# Back office — API pour agent IA (clé admin)

Ce document est destiné à un agent IA connecté au back office
avec une **clé API admin**. Il décrit l'authentification, tous les endpoints
`/api/v1`, les règles métier et le serveur MCP prêt à l'emploi.

- **Base URL** : `https://hub.example.com`
- **Auth** : header `Authorization: Bearer sk_live_…`
- **Format** : JSON en entrée et en sortie, dates en ISO 8601 (UTC), montants en euros.

---

## 1. Authentification

Chaque requête doit porter la clé API en header :

```bash
curl -H "Authorization: Bearer sk_live_xxxxxxxx" \
  https://hub.example.com/api/v1/projects
```

- La clé est créée dans **/admin/settings/api-keys** et n'est affichée qu'une seule fois.
- Une clé porte des **scopes** : chaque endpoint exige le sien (voir tableau ci-dessous).
- Une clé révoquée ou expirée renvoie `401 UNAUTHORIZED`.
- Une clé admin voit **toutes** les données ; une clé client est isolée sur son propre client (multi-tenant).

### Format d'erreur (uniforme)

```json
{ "error": { "code": "FORBIDDEN", "message": "Missing scope(s): finance:read." } }
```

| HTTP | Code | Signification |
|------|------|---------------|
| 401 | `UNAUTHORIZED` | Clé absente, invalide, révoquée ou expirée |
| 403 | `FORBIDDEN` | Scope manquant, ou endpoint réservé admin |
| 404 | `NOT_FOUND` | Ressource introuvable (ou hors du périmètre de la clé) |
| 422 | `VALIDATION` / `INVALID` | Corps ou paramètres invalides, transition de statut interdite |
| 500 | `INTERNAL` | Erreur serveur |

### Scopes

| Scope | Donne accès à |
|-------|---------------|
| `projects:read` | `GET /projects` |
| `tickets:read` | `GET /tickets`, `GET /tickets/{id}` |
| `tickets:write` | `POST /tickets`, `PATCH /tickets/{id}` |
| `comments:write` | `POST /tickets/{id}/comments` |
| `stats:read` | `GET /stats` *(admin uniquement)* |
| `finance:read` | `GET /finance` *(admin uniquement)* |
| `documents:read` | `GET /documents` |
| `documents:write` | `POST /documents` *(admin uniquement)* |

---

## 2. Endpoints

### `GET /api/v1/projects` — scope `projects:read`

Liste tous les projets avec client, jalons et nombre de tickets. Pas de paramètres.

```json
{
  "projects": [
    {
      "id": "…", "name": "Site vitrine", "description": "…",
      "status": "IN_PROGRESS", "url": "https://…",
      "client": { "id": "…", "name": "ACME" },
      "ticketCount": 4,
      "milestones": [
        { "id": "…", "title": "Maquettes", "status": "DONE",
          "dueDate": "2026-05-01T00:00:00.000Z", "completedAt": "…" }
      ],
      "createdAt": "2026-03-12T09:00:00.000Z"
    }
  ]
}
```

### `GET /api/v1/tickets` — scope `tickets:read`

Liste paginée des tickets (retours clients). Paramètres de query, tous optionnels :

| Paramètre | Valeurs |
|-----------|---------|
| `status` | `NEW`, `IN_PROGRESS`, `IN_DEV`, `WAITING_ON_CLIENT`, `RESOLVED`, `CLOSED` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `type` | `BUG`, `DESIGN_FEEDBACK`, `EVOLUTION`, `QUESTION` |
| `projectId`, `clientId` | ids |
| `overdue` | `true` → uniquement les tickets en retard de SLA |
| `sort` | `createdAt`, `dueDate`, `priority`, `updatedAt` |
| `order` | `asc`, `desc` |

> `IN_DEV` est un statut interne (fonctionnel en dev, pas encore déployé) : les acteurs client ne le voient jamais — il leur est présenté comme `IN_PROGRESS`.
| `limit` | 1–100 |
| `cursor` | curseur de pagination renvoyé par l'appel précédent |

Réponse : `{ "tickets": [Ticket], "nextCursor": "…" | null }`. Pour paginer,
rappeler l'endpoint avec `cursor=nextCursor` jusqu'à `nextCursor: null`.

Forme d'un `Ticket` (liste) :

```json
{
  "id": "…", "number": 42, "title": "Bouton cassé sur mobile",
  "type": "BUG", "priority": "HIGH", "status": "IN_PROGRESS",
  "dueDate": "2026-07-25T00:00:00.000Z",
  "resolvedAt": null, "closedAt": null,
  "createdAt": "…", "updatedAt": "…",
  "project": { "id": "…", "name": "…", "client": { "id": "…", "name": "…" } },
  "createdBy": { "id": "…", "name": "…" }
}
```

### `GET /api/v1/tickets/{id}` — scope `tickets:read`

Détail complet : mêmes champs que la liste, plus `description`, `attachments[]`
(`id`, `url`, `filename`, `contentType`) et `comments[]` (`id`, `body`, `author`,
`createdAt`, `attachments[]`).

### `POST /api/v1/tickets` — scope `tickets:write`

```json
{
  "projectId": "…",
  "title": "3 à 200 caractères",
  "description": "1 à 10000 caractères",
  "type": "BUG | DESIGN_FEEDBACK | EVOLUTION | QUESTION",
  "priority": "LOW | MEDIUM | HIGH | URGENT (défaut MEDIUM)"
}
```

Réponse `201` : `{ "ticket": Ticket }`.

### `PATCH /api/v1/tickets/{id}` — scope `tickets:write`

Tous les champs sont optionnels ; n'envoyer que ce qui change :

```json
{
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  "dueDate": "2026-08-01T00:00:00.000Z",
  "title": "Nouveau titre"
}
```

- `dueDate` : datetime ISO 8601, ou `null` pour supprimer la deadline.
- **Transitions de statut** : avec une clé admin, toutes les transitions sont
  permises (réouverture incluse) sauf le statut identique. Une transition
  interdite renvoie `422 INVALID`.
- Un changement de statut par l'admin **notifie le créateur du ticket par email**.
- `RESOLVED` renseigne `resolvedAt`, `CLOSED` renseigne `closedAt` ; une
  réouverture les efface.

### `POST /api/v1/tickets/{id}/comments` — scope `comments:write`

```json
{ "body": "1 à 10000 caractères" }
```

Réponse `201` : `{ "comment": { "id", "body", "author", "createdAt" } }`.

⚠️ **Le client est notifié par email à chaque commentaire.** Ne pas commenter en
rafale ni pour un usage interne : privilégier un commentaire consolidé.

### `GET /api/v1/stats` — scope `stats:read` *(admin uniquement)*

KPIs du back office : tickets ouverts/en retard, temps moyen de résolution,
respect du SLA, charge hebdomadaire, répartition par projet. Pas de paramètres.
Réponse : `{ "stats": { … } }`.

### `GET /api/v1/finance?year=2026` — scope `finance:read` *(admin uniquement)*

Vue financière micro-entreprise. `year` optionnel (défaut : année en cours).

```json
{
  "year": 2026,
  "urssafRates": { "serviceBnc": 24.6, "goods": 12.3 },
  "global": { … },
  "currentYearDetail": {
    "bncHtYear": 30000, "goodsHtYear": 2000,
    "urssafEstimatedYear": 7626, "netAfterUrssafYear": 24374,
    "incomeTax": {
      "taxableBase": 17200,
      "baremeEstimate": 900,
      "versementLiberatoireEstimate": 680
    },
    "months": [
      { "month": 1, "bncHt": 2500, "goodsHt": 0, "declaredHt": 2500,
        "urssafEstimated": 615, "netAfterUrssaf": 1885 }
    ]
  }
}
```

À savoir :

- Le CA est ventilé **prestations BNC** vs **ventes de marchandises** (taux URSSAF différents).
- Un **CA manuel saisi dans l'app remplace le suivi automatique** pour son mois.
- `currentYearDetail` (et `months`) n'existe **que pour l'année en cours** ;
  pour une année passée il vaut `null` (seul `global` est renseigné).
- Toutes les valeurs URSSAF/impôt sont des **estimations**, pas des montants déclarés.

### `GET /api/v1/documents` — scope `documents:read`

Query optionnelle : `type` (`INVOICE`, `QUOTE`) et `status`
(`DRAFT`, `ISSUED`, `ACCEPTED`, `REFUSED`, `PAID`, `CANCELLED`).
Renvoie au plus 200 documents, les plus récents d'abord.

```json
{
  "documents": [
    {
      "id": "…", "type": "INVOICE", "status": "PAID",
      "activity": "SERVICE_BNC", "number": "FA-2026-0007",
      "client": { "id": "…", "name": "ACME" },
      "project": { "id": "…", "name": "Site vitrine" },
      "vatRate": 0, "subtotalHt": 1500, "vatAmount": 0, "totalTtc": 1500,
      "issueDate": "…", "dueDate": "…", "validUntil": null,
      "paidAt": "…", "createdAt": "…"
    }
  ]
}
```

`number` est `null` tant que le document est un brouillon (la numérotation
légale n'est attribuée qu'à l'émission).

### `POST /api/v1/documents` — scope `documents:write` *(admin uniquement)*

Crée un **brouillon** de facture ou de devis. L'émission (numérotation légale,
envoi) reste une **action manuelle dans l'app** — l'API ne peut pas émettre.

```json
{
  "type": "INVOICE | QUOTE",
  "clientId": "…",
  "projectId": "… (optionnel, doit appartenir au client)",
  "activity": "SERVICE_BNC (défaut) | GOODS",
  "vatRate": 0,
  "items": [
    { "description": "Développement page contact", "quantity": 2, "unitPrice": 400 }
  ],
  "notes": "optionnel, max 2000 caractères"
}
```

- `quantity × unitPrice` = total HT de la ligne ; `unitPrice` est **HT**.
- Micro-entreprise en franchise de TVA → `vatRate: 0` en général.
- Réponse `201` : `{ "document": Document }` (même forme que la liste, `status: "DRAFT"`).

---

## 3. Serveur MCP (recommandé pour les agents)

Le package `@backoffice/mcp-server` (monorepo, `packages/mcp-server`) expose ces
endpoints comme outils MCP via stdio. C'est un pur wrapper HTTP de l'API — mêmes
scopes, mêmes règles.

Configuration (exemple de client MCP) :

```json
{
  "mcpServers": {
    "backoffice": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "BACKOFFICE_API_URL": "https://hub.example.com",
        "BACKOFFICE_API_KEY": "sk_live_…"
      }
    }
  }
}
```

| Outil MCP | Endpoint |
|-----------|----------|
| `list_projects` | `GET /projects` |
| `list_tickets` | `GET /tickets` |
| `get_ticket` | `GET /tickets/{id}` |
| `create_ticket` | `POST /tickets` |
| `update_ticket` | `PATCH /tickets/{id}` |
| `add_comment` | `POST /tickets/{id}/comments` |
| `get_stats` | `GET /stats` |
| `get_finance` | `GET /finance` |
| `list_documents` | `GET /documents` |
| `create_document_draft` | `POST /documents` |

---

## 4. Règles à respecter (agent)

1. **Lecture d'abord** : vérifier l'état actuel (`get_ticket`, `list_documents`)
   avant toute écriture.
2. **Commentaires = emails client** : consolider, ne jamais spammer.
3. **Documents** : uniquement des brouillons ; ne jamais annoncer qu'une facture
   a été « envoyée » ou « émise » — c'est une action manuelle de l'admin.
4. **Finance** : données sensibles et estimatives ; les présenter comme telles.
5. **Pagination** : suivre `nextCursor` pour toute analyse exhaustive des tickets.
6. **Erreurs 422 sur transition de statut** : relire le statut courant du ticket
   et proposer une transition valide, ne pas réessayer en boucle.
7. La clé API est un secret : ne jamais l'inclure dans un texte, un log ou un
   commentaire.
