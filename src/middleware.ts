import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "immo_session";
const SESSION_SALT = process.env.NEXTAUTH_SECRET || "immotracker-session-salt-default-key-32";

async function hashSessionToken(username: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${username.trim().toLowerCase()}:${password}:${SESSION_SALT}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD || process.env.ADMIN_PASSWORD;
  const appUsername = (process.env.APP_USERNAME || process.env.ADMIN_USERNAME || "admin").trim();

  // Wenn kein Passwort in der Umgebung konfiguriert ist, alles erlauben
  if (!appPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Öffentliche Pfade ohne Login-Zwang
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  // Session-Cookie prüfen
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const expectedToken = await hashSessionToken(appUsername, appPassword);

  if (sessionCookie && sessionCookie === expectedToken) {
    return NextResponse.next();
  }

  // Nicht autorisiert: Für API JSON 401, für Browser-Seiten Weiterleitung auf /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Nicht autorisiert. Bitte im Immotracker anmelden." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
