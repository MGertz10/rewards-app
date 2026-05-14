// GET  /api/points-balances          — returns current manually-set points balances
// POST /api/points-balances          — upsert a balance { program, balance, notes }
// GET  /api/points-balances?earned=1 — calculate earned points from recent Plaid transactions

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CARDS, getMultiplier, CPP } from "@/lib/cards";

// Map Plaid personal_finance_category → optimizer category
const PLAID_TO_CARD_CATEGORY: Record<string, string> = {
  FOOD_AND_DRINK:        "dining",
  TRANSPORTATION:        "travel",
  TRAVEL:                "travel",
  GENERAL_MERCHANDISE:   "other",
  SHOPPING:              "other",
  ENTERTAINMENT:         "entertainment",
  RENT_AND_UTILITIES:    "other",
  GROCERIES:             "groceries",
  GAS_STATIONS:          "gas",
  HOTEL:                 "hotel",
  AIRLINE:               "flight",
  RENTAL_CAR:            "rental_car",
  STREAMING_SUBSCRIPTIONS: "streaming",
  PHARMACIES:            "drugstore",
};

// Map Plaid account name fragments → card IDs
function guessCardFromAccount(accountName: string): string | null {
  const n = accountName.toLowerCase();
  if (n.includes("freedom unlimited") || n.includes("cfu")) return "cfu";
  if (n.includes("sapphire preferred") || n.includes("csp")) return "csp";
  if (n.includes("boundless") || n.includes("marriott")) return "boundless";
  if (n.includes("venture x")) return "venture_x";
  if (n.includes("venture") && !n.includes("x")) return "venture_x"; // fallback
  if (n.includes("chase") && n.includes("credit")) return "cfu"; // generic Chase credit → CFU
  if (n.includes("capital one")) return "venture_x";
  return null;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const earnedMode = searchParams.get("earned") === "1";

  try {
    const supabase = await createClient();

    if (earnedMode) {
      // ── Calculate earned points from last 90 days of Plaid transactions ──────
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: txns, error } = await supabase
        .from("transactions")
        .select("amount, category, account_id, posted_at")
        .gte("posted_at", since.toISOString())
        .gt("amount", 0); // positive = spend (Plaid convention)

      if (error) throw error;

      // Also pull account names so we can guess card
      const { data: accounts } = await supabase
        .from("card_balances")
        .select("account_id, name, card_id");

      const accountMap = new Map<string, { name: string; cardId: string | null }>(
        (accounts ?? []).map((a) => [
          a.account_id,
          { name: a.name ?? "", cardId: a.card_id ?? null },
        ])
      );

      // Accumulate earned per program
      const earned: Record<string, number> = { chase_ur: 0, capital_one: 0, marriott_bonvoy: 0 };

      for (const tx of txns ?? []) {
        const acct = accountMap.get(tx.account_id);
        if (!acct) continue;

        const cardId = acct.cardId ?? guessCardFromAccount(acct.name);
        if (!cardId) continue;

        const card = CARDS.find((c) => c.id === cardId);
        if (!card) continue;

        const plaidCat = (tx.category ?? "").toUpperCase();
        const cardCat = (PLAID_TO_CARD_CATEGORY[plaidCat] ?? "other") as Parameters<typeof getMultiplier>[1];
        const { multiplier } = getMultiplier(card, cardCat);
        const pts = Math.round(tx.amount * multiplier);

        if (card.pointsProgram in earned) {
          earned[card.pointsProgram as keyof typeof earned] += pts;
        }
      }

      return NextResponse.json({ earned, txnCount: (txns ?? []).length });
    }

    // ── Read stored manual balances ───────────────────────────────────────────
    const { data, error } = await supabase
      .from("points_balances")
      .select("program, balance, notes, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ balances: data ?? [] });
  } catch (err) {
    console.error("[api/points-balances GET]", err);
    return NextResponse.json({ balances: [], earned: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { program, balance, notes } = await req.json();
    if (!program || balance === undefined) {
      return NextResponse.json({ error: "Missing program or balance" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("points_balances")
      .upsert(
        { program, balance: Number(balance), notes: notes ?? null, updated_at: new Date().toISOString() },
        { onConflict: "program" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/points-balances POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
