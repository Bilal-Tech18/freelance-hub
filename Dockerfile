# Image unique de l'app (Next.js + Prisma). Voir docker-compose.yml pour
# lancer l'app avec sa base Postgres en une commande.

FROM node:20-bookworm-slim AS base
# openssl : requis par le moteur Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backoffice/package.json apps/backoffice/
COPY packages/mcp-server/package.json packages/mcp-server/
RUN npm ci

FROM deps AS build
COPY . .
# Clé publique Web Push : inlinée côté navigateur, donc fixée au build (optionnelle).
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# NEXT_PUBLIC_APP_URL n'est volontairement PAS défini ici : il n'est lu que côté
# serveur et reste ainsi configurable au démarrage du conteneur.
# Placeholders : ni prisma generate ni next build n'ont besoin d'une vraie base.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-only-placeholder-not-used-at-runtime" \
    npm run build --workspace backoffice \
  && rm -rf apps/backoffice/.next/cache

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001
# Les dépendances de dev restent : prisma (migrations) et tsx (seeds) servent au démarrage.
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3001
VOLUME ["/app/data"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
