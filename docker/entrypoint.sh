#!/bin/sh
# Démarrage du conteneur : secrets, migrations, seeds, puis serveur Next.
set -e

# Secrets non fournis : générés au premier démarrage puis conservés dans le
# volume /app/data, pour que sessions et Vault survivent aux redémarrages.
SECRETS_FILE=/app/data/secrets.env
touch "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"
for name in BETTER_AUTH_SECRET VAULT_ENCRYPTION_KEY CRON_SECRET; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    value=$(grep "^$name=" "$SECRETS_FILE" | cut -d= -f2-)
    if [ -z "$value" ]; then
      value=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
      echo "$name=$value" >> "$SECRETS_FILE"
      echo "[entrypoint] $name généré dans $SECRETS_FILE"
    fi
    export "$name=$value"
  fi
done

cd /app/apps/backoffice
./node_modules/.bin/prisma migrate deploy

# Les deux seeds sont idempotents : le compte admin n'est créé qu'une fois et la
# démo refuse de se charger sur une base qui contient déjà des clients.
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  /app/node_modules/.bin/tsx prisma/seed.ts
fi
if [ "${DEMO_DATA:-false}" = "true" ]; then
  /app/node_modules/.bin/tsx prisma/seed-demo.ts
fi

exec ./node_modules/.bin/next start -p "${PORT:-3001}"
