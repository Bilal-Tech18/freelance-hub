# Freelance Hub — app

Espace client (tickets, onboarding, timeline) + cockpit admin (KPIs, kanban, API keys, MCP).

## Démarrage

```bash
# 1. Variables d'environnement
cp .env.example .env   # puis remplir (voir ci-dessous)

# 2. Base de données (Postgres)
npm run db:migrate     # crée les tables (nécessite DATABASE_URL)
npm run db:seed        # crée l'admin (ADMIN_EMAIL / ADMIN_PASSWORD)

# 3. Lancer
npm run dev            # http://localhost:3001
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Postgres (en serverless : ajouter `?connection_limit=5&pool_timeout=10`) |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | URL de l'app (`http://localhost:3001` en dev) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin créé par le seed |
| `RESEND_API_KEY` / `EMAIL_FROM` | Emails (vide en dev → console.log) |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | Upload des captures d'écran |
| `VAULT_ENCRYPTION_KEY` | Chiffrement du Vault (`openssl rand -hex 32`) |
| `CRON_SECRET` | Secret de `/api/cron/tick` (monitoring + relances) |

## Architecture

- **Auth** : Better Auth (email + mdp, signup public désactivé, invitations par token). Rôles `ADMIN` / `CLIENT`.
- **Sécurité** : `src/lib/authz.ts` — `requireAdmin()` / `requireUser()` dans chaque server action + `getScopedProjectWhere()` sur chaque requête projet/ticket. Le proxy (`src/proxy.ts`) ne fait qu'un check optimiste de cookie.
- **Service partagé** : `src/lib/services/tickets.ts` est utilisé par les server actions ET `/api/v1` → mêmes règles, mêmes emails.
- **SLA** : deadline auto par priorité (jours ouvrés) dans `src/lib/sla.ts`, surchargeable par l'admin.
- **Uploads** : navigateur → Cloudinary en direct (signé par `/api/uploads/sign`), jamais via nos fonctions serverless.

## API publique (`/api/v1`)

Auth : `Authorization: Bearer sk_live_…` (clés créées dans `/admin/settings/api-keys`, scopes : `projects:read`, `tickets:read`, `tickets:write`, `comments:write`, `stats:read`).

Endpoints : `GET /projects` · `GET|POST /tickets` · `GET|PATCH /tickets/:id` · `POST /tickets/:id/comments` · `GET /stats`.

## MCP

`packages/mcp-server` expose l'API en tools MCP (`list_tickets`, `update_ticket`, `get_stats`…).

```bash
npx turbo build --filter=@backoffice/mcp-server
# .mcp.json à la racine du repo — exporter BACKOFFICE_API_KEY
```

## Tests

```bash
npm test               # vitest (SLA, transitions de statut)
```
