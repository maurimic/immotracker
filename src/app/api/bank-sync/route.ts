import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WEBHOOKS: Record<string, string> = {
  maurizio: "https://n8n-maurizio.duckdns.org/webhook/comdirect-Maurizio",
  steven: "https://n8n-maurizio.duckdns.org/webhook/comdirect-Steven",
};

/**
 * Bank-Sync Webhook Proxy
 * Startet den n8n-Comdirect-Workflow im Hintergrund ohne CORS-Probleme
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const account = (body.account || "").toLowerCase().trim();

    const webhookUrl = WEBHOOKS[account];
    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: `Unbekanntes Konto: "${body.account}". Gültig sind: maurizio, steven` },
        { status: 400 }
      );
    }

    // n8n Webhook anstoßen
    // Manche n8n-Webhooks erwarten GET, manche POST. Wir versuchen GET mit Fallback auf POST.
    // Timeout 12 Sekunden (falls n8n auf Push-TAN wartet)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let response = await fetch(webhookUrl, {
        method: "GET",
        signal: controller.signal,
      });

      // Falls GET 404 liefert ("The requested webhook GET ... is not registered"), versuchen wir POST
      if (response.status === 404) {
        response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "immotracker", requestedBy: account, timestamp: new Date().toISOString() }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      return NextResponse.json({
        success: true,
        status: response.status,
        message: `Workflow für ${account === "maurizio" ? "Maurizio" : "Steven"} erfolgreich angestoßen.`,
      });
    } catch (fetchErr: any) {
      // Wenn der Timeout anschlägt, bedeutet das meist, dass n8n den Webhook bereits verarbeitet
      // und auf die Push-TAN Freigabe wartet.
      if (fetchErr.name === "AbortError" || fetchErr.message?.includes("abort")) {
        return NextResponse.json({
          success: true,
          pendingTan: true,
          message: `Workflow für ${account === "maurizio" ? "Maurizio" : "Steven"} läuft und wartet auf Push-TAN.`,
        });
      }
      throw fetchErr;
    }
  } catch (error: any) {
    console.error("[Bank-Sync Webhook Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Fehler beim Aufruf des n8n-Webhooks",
      },
      { status: 500 }
    );
  }
}
