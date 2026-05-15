// GET /api/plaid/diagnose
// One-tap diagnostic dump for the Plaid → Supabase pipeline. Visit in a browser
// to see exactly which institutions are linked, whether their accounts have
// been synced into card_balances, and which (if any) Supabase queries are
// erroring. Designed for debugging without needing to dig through Vercel logs.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const [items, balances, txCount] = await Promise.all([
    supabase
      .from("plaid_items")
      .select("item_id, institution, updated_at, cursor"),
    supabase
      .from("card_balances")
      .select("plaid_account_id, item_id, name, mask, account_type, account_subtype, current_balance, credit_limit, as_of"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    summary: {
      plaid_items_count: items.data?.length ?? 0,
      card_balances_count: balances.data?.length ?? 0,
      transactions_count: txCount.count ?? 0,
    },
    plaid_items: items.data,
    plaid_items_error: items.error?.message ?? null,
    card_balances: balances.data,
    card_balances_error: balances.error?.message ?? null,
    transactions_error: txCount.error?.message ?? null,
  });
}
