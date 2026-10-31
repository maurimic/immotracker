import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLatestAccountBalance } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      return NextResponse.json({ success: true, ...data });
    }
  } catch (err) {
    const cached = await prisma.appSetting.findUnique({
      where: { key: "latest_account_balance" },
    });
    if (cached) {
      return NextResponse.json({ success: true, ...JSON.parse(cached.value), cached: true });
    }
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }

  const cached = await prisma.appSetting.findUnique({
    where: { key: "latest_account_balance" },
  });
  if (cached) {
    return NextResponse.json({ success: true, ...JSON.parse(cached.value), cached: true });
  }

  return NextResponse.json({ success: false, message: "Kein Kontostand gefunden" }, { status: 404 });
}
