import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

// Check optimiste (présence du cookie uniquement — pas de DB en proxy).
// La vraie autorisation vit dans les layouts + server actions (authz.ts).
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/invite/");

  if (!sessionCookie && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (
    sessionCookie &&
    pathname === "/login" &&
    !request.nextUrl.searchParams.has("expired")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // sw.js et manifest.webmanifest doivent rester publics : le navigateur les
  // télécharge hors session pour installer la PWA et recevoir les push.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|svg|jpg|ico)).*)",
  ],
};
