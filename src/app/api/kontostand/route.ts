import { NextResponse } from "next/server";
import { fetchBalanceAndAutoSyncPayments } from "@/lib/payment-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  try {
    const res = await fetchBalanceAndAutoSyncPayments();
    if (!res.accountBalance) {
      return NextResponse.json(
        { success: false, message: "Kein Kontostand gefunden" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        ...res.accountBalance,
        cached: res.cached,
        balanceUpdated: res.balanceUpdated,
        autoSyncedPayments: res.autoSyncedPayments,
      },
      { headers: noCacheHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
