import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLatestAccountBalance } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  try {
    const live = await fetchLatestAccountBalance();
    if (live) {
      const data = {
        amount: live.amount,
        date: live.date.toISOString(),
        formattedDate: live.formattedDate,
      };
      await prisma.appSetting.upsert({
        where: { key: "latest_account_balance" },
        create: {
          key: "latest_account_balance",
          value: JSON.stringify(data),
        },
        update: {
          value: JSON.stringify(data),
        },
      });
      return NextResponse.json({ success: true, ...data }, { headers: noCacheHeaders });
    }
  } catch (err) {
    const cached = await prisma.appSetting.findUnique({
      where: { key: "latest_account_balance" },
    });
    if (cached) {
      return NextResponse.json(
        { success: true, ...JSON.parse(cached.value), cached: true },
        { headers: noCacheHeaders }
      );
    }
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500, headers: noCacheHeaders }
    );
  }

  const cached = await prisma.appSetting.findUnique({
    where: { key: "latest_account_balance" },
  });
  if (cached) {
    return NextResponse.json(
      { success: true, ...JSON.parse(cached.value), cached: true },
      { headers: noCacheHeaders }
    );
  }

  return NextResponse.json(
    { success: false, message: "Kein Kontostand gefunden" },
    { status: 404, headers: noCacheHeaders }
  );
}
