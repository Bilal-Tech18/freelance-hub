// Crée (ou répare) un compte mainteneur.
// Usage : npx tsx --env-file=.env scripts/create-maintainer.ts <email> <nom> [password]
// Sans password fourni, un mot de passe temporaire est généré et affiché.

import { randomBytes } from "crypto";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { DEFAULT_MAINTENANCE_PALETTE } from "../src/lib/palette";

async function main() {
  const [email, name, passwordArg] = process.argv.slice(2);
  if (!email || !name) {
    throw new Error(
      "Usage : npx tsx --env-file=.env scripts/create-maintainer.ts <email> <nom> [password]"
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "MAINTAINER") {
      throw new Error(`Un compte existe déjà avec cet email (rôle ${existing.role}).`);
    }
    console.log(`Mainteneur déjà présent (${email}), rien à faire.`);
    return;
  }

  const password = passwordArg ?? randomBytes(9).toString("base64url");

  await auth.api.createUser({
    // Le plugin admin type `role` sur ses valeurs par défaut ("user"|"admin"),
    // la valeur runtime est libre.
    body: { email, password, name, role: "MAINTAINER" as "user" },
  });

  await db.user.update({
    where: { email },
    data: { emailVerified: true, palette: DEFAULT_MAINTENANCE_PALETTE },
  });

  console.log(`Mainteneur créé : ${email}`);
  console.log(`Mot de passe temporaire : ${password}`);
  console.log(
    "À transmettre en main propre — modifiable ensuite via « Mot de passe oublié »."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
