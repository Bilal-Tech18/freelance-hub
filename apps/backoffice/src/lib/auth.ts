import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Personne ne crée de compte librement : les clients arrivent via invitation
    // (auth.api.createUser côté serveur), l'admin via le seed.
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import("@/lib/emails");
      await sendPasswordResetEmail({ to: user.email, url });
    },
  },
  // Limites par IP, en mémoire (une seule instance Render).
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/forget-password": { window: 300, max: 3 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Chaque création de session = une connexion : journal permanent
        // (la session elle-même disparaît au logout). Ne bloque jamais le login.
        after: async (session) => {
          try {
            await db.loginEvent.create({
              data: {
                userId: session.userId,
                ipAddress: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
              },
            });
          } catch (err) {
            console.error("loginEvent create failed", err);
          }
        },
      },
    },
  },
  advanced: {
    ipAddress: {
      // cf-connecting-ip une fois Cloudflare devant, sinon x-forwarded-for (Render).
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
  user: {
    additionalFields: {
      clientId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    admin({
      adminRoles: ["ADMIN"],
      defaultRole: "CLIENT",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
