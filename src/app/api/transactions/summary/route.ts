// GET /api/transactions/summary?month=YYYY-MM
// Aggregates Plaid transactions for a given month into spending categories.
// Used by the dashboard to replace stale Sheets spending data with live Plaid data.
//
// Plaid sign convention: positive amount = money OUT (spend), negative = money IN (credit/payment)
//
// Filter logic:
//   - EXCLUDE from expenses: TRANSFER_IN, TRANSFER_OUT, PAYMENT, LOAN_PAYMENTS, INVESTMENTS, BANK_FEES
//     (credit card payments, inter-account transfers, investment contributions)
//   - Venmo transfers: Plaid marks them TRANSFER_IN/OUT → excluded from expenses automatically
//   - Income: negative amounts in INCOME category OR negative amounts that are payroll deposits

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Plaid personal_finance_category.primary values to display-friendly names
// that align with the user's budget categories (Food, Drinks, etc.)
const PLAID_TO_BUDGET: Record<string, string> = {
  FOOD_AND_DRINK:           "Food",
  TRANSPORTATION:           "Transportation",
  ENTERTAINMENT:            "Entertainment",
  PERSONAL_CARE:            "Personal Care",
  TRAVEL:                   "Travel",
  RENT_AND_UTILITIES:       "Housing",
  MEDICAL:                  "Health",
  HOME_IMPROVEMENT:         "Housing",
  GENERAL_MERCHANDISE:      "Shopping",
  SHOPPING:                 "Shopping",
  GENERAL_SERVICES:         "Services",
  GOVERNMENT_AND_NON_PROFIT:"Other",
  INCOME:                   "Income",
};

// Skip these entirely — they're not real spending
const SKIP_CATEGORIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "PAYMENT",         // credit card payments
  "LOAN_PAYMENTS",   // debt payments (tracked separately)
  "INVESTMENTS",     // brokerage deposits
  "BANK_FEES",       // minor fees
]);

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // "2025-05"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mo] = month.split("-").map(Number);
  const startDate = `${year}-${String(mo).padStart(2, "0")}-01`;
  // Last day of month
  const lastDay = new Date(year, mo, 0).getDate();
  const endDate = `${year}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    const supabase = await createClient();

    const { data: txs, error } = await supabase
      .from("transactions")
      .select("amount, category, merchant_raw, pending")
      .gte("posted_at", startDate)
      .lte("posted_at", endDate);

    if (error) throw error;

    if (!txs || txs.length === 0) {
      return NextResponse.json({ month, income: 0, expenses: 0, categories: {}, txCount: 0 });
    }

    // Only count posted (non-pending) transactions
    const posted = txs.filter((t) => !t.pending);

    let expenses = 0;
    const categories: Record<string, number> = {};

    for (const tx of posted) {
      const cat = tx.category ?? "OTHER";
      if (SKIP_CATEGORIES.has(cat)) continue;

      if (tx.amount > 0) {
        // Money out = expense
        expenses += tx.amount;
        const label = PLAID_TO_BUDGET[cat] ?? "Other";
        categories[label] = (categories[label] ?? 0) + tx.amount;
      }
      // Negative amounts (refunds, credits) reduce their category
      // We don't count them as income — they're offsets to expenses
    }

    // Round all category values to 2 decimal places
    for (const key of Object.keys(categories)) {
      categories[key] = Math.round(categories[key] * 100) / 100;
    }

    return NextResponse.json({
      month,
      expenses: Math.round(expenses * 100) / 100,
      categories,
      txCount: posted.length,
    });
  } catch (err) {
    console.error("[transactions/summary]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
