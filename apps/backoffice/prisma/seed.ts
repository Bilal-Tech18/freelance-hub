import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD sont requis pour le seed.");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin déjà présent (${email}), rien à faire.`);
    return;
  }

  await auth.api.createUser({
    // Le plugin admin type `role` sur ses valeurs par défaut ("user"|"admin"),
    // mais adminRoles: ["ADMIN"] rend la valeur runtime valide.
    body: { email, password, name, role: "ADMIN" as "admin" },
  });
  console.log(`Admin créé : ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
