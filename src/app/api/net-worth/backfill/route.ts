// POST /api/net-worth/backfill
// Reads full historical net worth from Google Sheets (falls back to seed data)
// and upserts one snapshot per month into net_worth_snapshots.
// Safe to call repeatedly — upserts on conflict.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveData } from "@/lib/sheets-live";
import { BUDGET_SEED } from "@/lib/budget-seed";

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// "Apr '24" → "2024-04-01"  |  "Apr '24" also handled as "Apr 24"
function parseMonthLabel(label: string): string | null {
  const m = label.match(/^(\w{3})\s+'?(\d{2})$/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (!month) return null;
  const year = `20${m[2]}`;
  return `${year}-${month}-01`;
}

export async function POST() {
  try {
    // Attempt live Sheets data; fall back to seed if env vars not set
    let months;
    try {
      const live = await fetchLiveData();
      months = live.months;
    } catch {
      console.warn("[backfill] Sheets fetch failed — using seed data");
      months = BUDGET_SEED.months;
    }

    const supabase = await createClient();

    const rows = months
      .filter(m => m.netWorth > 0)
      .map(m => {
        const date = parseMonthLabel(m.month);
        if (!date) return null;
        return {
          recorded_date: date,
          total_assets: m.netWorth,   // We don't have breakdown historically — use NW as proxy
          total_liabilities: 0,
          net_worth: m.netWorth,
          breakdown: {
            income: m.income,
            expenses: m.expenses,
            savings: m.savings,
            source: "google_sheets",
          },
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: "No net worth data found" });
    }

    const { error: upsertErr } = await supabase
      .from("net_worth_snapshots")
      .upsert(rows as {
        recorded_date: string;
        total_assets: number;
        total_liabilities: number;
        net_worth: number;
        breakdown: object;
      }[], { onConflict: "recorded_date" });

    if (upsertErr) {
      console.error("[backfill] upsert error:", upsertErr);
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("[backfill]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
