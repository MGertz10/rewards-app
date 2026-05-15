// GET /api/months/summary?month=YYYY-MM
// Unified monthly summary: returns income, expenses, and category breakdown
// for the requested month. Prefers live Plaid transactions if any exist for
// that month, otherwise falls back to the historical budget seed.
// Designed so that every Dashboard month chip shows non-zero data — Plaid
// for the current month (once syncing), budget seed for everything older.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUDGET_SEED } from "@/lib/budget-seed";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Convert "2026-04" → "Apr '26" — matches budget-seed.ts month label format
function toSeedLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`;
}

const SKIP_CATEGORIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "PAYMENT",
  "LOAN_PAYMENTS",
  "INVESTMENTS",
  "BANK_FEES",
]);

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mo] = month.split("-").map(Number);
  const startDate = `${year}-${String(mo).padStart(2, "0")}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const endDate = `${year}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // ── Plaid first ────────────────────────────────────────────────────────────
  let plaidExpenses = 0;
  let plaidIncome = 0;
  const plaidCategories: Record<string, number> = {};
  let plaidTxCount = 0;

  try {
    const supabase = await createClient();
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, category, pending")
      .gte("posted_at", startDate)
      .lte("posted_at", endDate);

    if (txs?.length) {
      const posted = txs.filter((t) => !t.pending);
      for (const tx of posted) {
        const cat = tx.category ?? "OTHER";
        if (SKIP_CATEGORIES.has(cat)) continue;
        if (tx.amount > 0) {
          plaidExpenses += tx.amount;
          plaidCategories[cat] = (plaidCategories[cat] ?? 0) + tx.amount;
        } else if (cat === "INCOME") {
          plaidIncome += Math.abs(tx.amount);
        }
      }
      plaidTxCount = posted.length;
    }
  } catch (err) {
    console.warn("[months/summary] plaid query failed:", err);
  }

  // ── Budget seed fallback ───────────────────────────────────────────────────
  const seedMonth = BUDGET_SEED.months.find((m) => m.month === toSeedLabel(month));
  const useSeed = plaidTxCount === 0 && !!seedMonth;

  // Round category values to 2 decimal places
  const roundedPlaidCategories: Record<string, number> = {};
  for (const k of Object.keys(plaidCategories)) {
    roundedPlaidCategories[k] = Math.round(plaidCategories[k] * 100) / 100;
  }

  return NextResponse.json({
    month,
    source: useSeed ? "budget_seed" : plaidTxCount > 0 ? "plaid" : "empty",
    income:   useSeed ? seedMonth!.income   : Math.round(plaidIncome * 100) / 100,
    expenses: useSeed ? seedMonth!.expenses : Math.round(plaidExpenses * 100) / 100,
    categories: useSeed ? seedMonth!.categories : roundedPlaidCategories,
    txCount: plaidTxCount,
  });
}
