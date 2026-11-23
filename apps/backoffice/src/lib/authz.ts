import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as SessionUser & Record<string, unknown>;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role ?? "CLIENT",
    clientId: u.clientId ?? null,
  };
}

/** Toute page/action authentifiée passe par ici. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  // ?expired=1 : signale au proxy que le cookie est invalide (sinon il
  // renverrait /login vers / en boucle sur simple présence du cookie).
  if (!user) redirect("/login?expired=1");
  return user;
}

/** Pages/actions réservées à l'admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Rôles internes (équipe) : admin + mainteneur. */
export function isStaffRole(role: string) {
  return role === "ADMIN" || role === "MAINTAINER";
}

/** Pages/actions réservées au mainteneur (espace /maintenance). */
export async function requireMaintainer(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "MAINTAINER") redirect("/");
  return user;
}

/** Pages/actions accessibles à l'équipe (admin ou mainteneur). */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaffRole(user.role)) redirect("/");
  return user;
}

/**
 * Invariant de sécurité n°1 : toute requête sur Project (et, via la relation
 * `project`, sur Ticket/Milestone/Onboarding) est filtrée par ce where.
 * Admin → tout ; mainteneur → ses projets assignés ; client → uniquement
 * les projets de son Client.
 */
export function getScopedProjectWhere(user: {
  id?: string;
  role: string;
  clientId: string | null;
}) {
  if (user.role === "ADMIN") return {};
  if (user.role === "MAINTAINER") {
    return { assignments: { some: { userId: user.id ?? "__none__" } } };
  }
  // Un client sans clientId ne doit rien voir.
  return { clientId: user.clientId ?? "__none__" };
}
