import { NextResponse } from "next/server";
import { testGoogleSheetsConnection } from "@/lib/google-sheets";
import { runManualGoogleSheetsSync } from "@/lib/payment-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/payments/sync
 * Prüft den Google Sheets Verbindungsstatus
 */
export async function GET() {
  try {
    const status = await testGoogleSheetsConnection();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: message,
        spreadsheetId:
          process.env.GOOGLE_SHEETS_ID ||
          process.env.GOOGLE_SPREADSHEET_ID ||
          "1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU",
        sheetName: process.env.GOOGLE_SHEET_NAME || "Kontobewegung",
        serviceAccountEmail:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
          "immobiliendashboard@n8n-self-host-458810.iam.gserviceaccount.com",
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/payments/sync
 * Synchronisiert Buchungen aus Google Sheets und matched sie automatisch
 */
export async function POST() {
  try {
    const result = await runManualGoogleSheetsSync();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
