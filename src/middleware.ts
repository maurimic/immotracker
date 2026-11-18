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
  const { pathname } = request.nextUrl;

  // Ausnahme: /api/health und statische Assets immer erlauben
  if (
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  const appPassword = process.env.APP_PASSWORD || process.env.ADMIN_PASSWORD;
  const appUsername = (process.env.APP_USERNAME || process.env.ADMIN_USERNAME || "admin").trim();

  // Fail-Closed: Wenn kein Passwort in den Umgebungsvariablen konfiguriert ist, Zugriff blockieren
  if (!appPassword) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "Zugriff blockiert (Fail-Closed): In den Server-Umgebungsvariablen ist kein APP_PASSWORD konfiguriert.",
        },
        { status: 503 }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zugriff blockiert - Konfigurationsfehler</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #111827; border: 1px solid #ef4444; border-radius: 0.75rem; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { color: #f87171; font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem; }
    p { color: #9ca3af; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1rem; }
    code { background: #1f2937; color: #38bdf8; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Zugriff blockiert (Fail-Closed)</h1>
    <p>In den Server-Umgebungsvariablen wurde kein <code>APP_PASSWORD</code> konfiguriert.</p>
    <p>Aus Sicherheitsgründen ist der Zugriff auf Immotracker gesperrt, bis ein sicheres Passwort in der Konfiguration hinterlegt wird.</p>
  </div>
</body>
</html>`,
      {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }

  // Öffentliche Pfade ohne Login-Zwang
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/")
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
