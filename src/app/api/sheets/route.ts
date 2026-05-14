import { NextResponse } from "next/server";
import { BUDGET_SEED } from "@/lib/budget-seed";
import { transformBudgetData } from "@/lib/dashboard";

// Live data is fetched from Google Sheets when both env vars are set:
//   GOOGLE_SHEETS_ID          — spreadsheet ID from the URL
//   GOOGLE_SERVICE_ACCOUNT    — full service account JSON (stringified)

const hasLiveCredentials =
  !!process.env.GOOGLE_SHEETS_ID && !!process.env.GOOGLE_SERVICE_ACCOUNT;

export async function GET() {
  if (hasLiveCredentials) {
    try {
      const { fetchLiveData } = await import("@/lib/sheets-live");
      const raw = await fetchLiveData();
      const data = transformBudgetData(raw);
      return NextResponse.json({ data, source: "live", lastUpdated: new Date().toISOString() });
    } catch (err) {
      console.error("[sheets] Live fetch failed, falling back to seed:", err);
    }
  }

  const data = transformBudgetData(BUDGET_SEED);
  return NextResponse.json({
    data,
    source: "seed",
    lastUpdated: new Date().toISOString(),
  });
}
