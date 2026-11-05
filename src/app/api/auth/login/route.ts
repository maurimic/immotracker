import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "immo_session";
const SESSION_SALT = process.env.NEXTAUTH_SECRET || "immotracker-session-salt-default-key-32";

async function hashSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:${SESSION_SALT}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD || process.env.ADMIN_PASSWORD;

    if (!appPassword) {
      return NextResponse.json(
        { error: "Auf diesem Server ist kein APP_PASSWORD in der .env hinterlegt." },
        { status: 500 }
      );
    }

    if (password !== appPassword) {
      return NextResponse.json(
        { error: "Das eingegebene Passwort ist nicht korrekt." },
        { status: 401 }
      );
    }

    const token = await hashSessionToken(appPassword);
    const response = NextResponse.json({ success: true });

    // Cookie für 30 Tage setzen
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Fehler beim Anmelden" },
      { status: 500 }
    );
  }
}
