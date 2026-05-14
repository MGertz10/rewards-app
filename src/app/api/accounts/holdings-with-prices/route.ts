// GET /api/accounts/holdings-with-prices
// Returns ALL investment accounts — both Plaid-synced and manually entered —
// with their fund/position-level holdings enriched with live Yahoo Finance prices.
//
// Source priority: Plaid investment accounts first (auto-synced), then manual accounts.
// Live prices override Plaid's cached close_price when a ticker is recognized.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface HoldingWithPrice {
  id: string;
  ticker: string | null;
  name: string;
  shares: number;
  asset_class: string | null;   // equity | fixed income | cash | real_estate | other
  cost_basis_per_share: number | null;
  livePrice: number | null;
  liveValue: number | null;
  costBasis: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
}

export interface AccountWithHoldings {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  source: "plaid" | "manual";
  liveValue: number | null;
  holdings: HoldingWithPrice[];
}

// ── Row types from Supabase queries ───────────────────────────────────────────
interface PlaidHoldingRow {
  id: string;
  plaid_account_id: string;
  ticker: string | null;
  name: string;
  quantity: number | null;
  close_price: number | null;
  cost_basis: number | null;
  value: number | null;
  asset_class: string | null;
}

interface ManualHoldingRow {
  id: string;
  account_id: string;
  ticker: string | null;
  name: string | null;
  shares: number;
  cost_basis_per_share: number | null;
  asset_class: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // ── Load everything in parallel ────────────────────────────────────────
    const [
      { data: manualAccounts },
      { data: manualHoldings },
      { data: plaidInvAccounts },
      { data: plaidItems },
    ] = await Promise.all([
      supabase
        .from("manual_accounts")
        .select("id, name, institution, account_type, balance")
        .order("name"),
      supabase
        .from("manual_holdings")
        .select("id, account_id, ticker, name, shares, cost_basis_per_share, asset_class")
        .order("ticker"),
      // Plaid investment accounts — stored in card_balances with account_type = 'investment'
      supabase
        .from("card_balances")
        .select("plaid_account_id, name, mask, current_balance, account_subtype, item_id")
        .eq("account_type", "investment"),
      supabase
        .from("plaid_items")
        .select("item_id, institution"),
    ]);

    // Fetch Plaid holdings for any connected investment accounts
    const plaidAccountIds = (plaidInvAccounts ?? []).map((a) => a.plaid_account_id);
    const { data: plaidHoldings } = plaidAccountIds.length > 0
      ? await supabase
          .from("plaid_holdings")
          .select("id, plaid_account_id, ticker, name, quantity, close_price, cost_basis, value, asset_class")
          .in("plaid_account_id", plaidAccountIds)
          .order("name")
      : { data: [] };

    // ── Collect all unique tickers → fetch live prices at once ─────────────
    const allTickers = new Set<string>();
    for (const h of manualHoldings ?? []) {
      if (h.ticker) allTickers.add(h.ticker.toUpperCase());
    }
    for (const h of plaidHoldings ?? []) {
      if (h.ticker) allTickers.add(h.ticker.toUpperCase());
    }

    let prices: Record<string, number | null> = {};
    if (allTickers.size > 0) {
      const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
      try {
        const res = await fetch(
          `${base}/api/prices?tickers=${[...allTickers].join(",")}`,
          { next: { revalidate: 300 } }
        );
        if (res.ok) prices = (await res.json()).prices ?? {};
      } catch {
        // proceed without live prices
      }
    }

    // ── Helper: compute enriched holding fields ────────────────────────────
    function enrich(opts: {
      id: string;
      ticker?: string | null;
      name: string;
      shares: number;
      asset_class?: string | null;
      costBasisPerShare?: number | null;
      plaidClosePrice?: number | null;
    }): HoldingWithPrice {
      const ticker = opts.ticker?.toUpperCase() ?? null;
      // Prefer Yahoo live price; fall back to Plaid's last close price
      const livePrice =
        ticker && prices[ticker] != null
          ? (prices[ticker] as number)
          : (opts.plaidClosePrice ?? null);
      const liveValue = livePrice !== null ? livePrice * opts.shares : null;
      const costBasis =
        opts.costBasisPerShare != null ? opts.costBasisPerShare * opts.shares : null;
      const gainLoss =
        liveValue !== null && costBasis !== null ? liveValue - costBasis : null;
      const gainLossPct =
        gainLoss !== null && costBasis && costBasis > 0
          ? (gainLoss / costBasis) * 100
          : null;
      return {
        id: opts.id,
        ticker,
        name: opts.name,
        shares: opts.shares,
        asset_class: opts.asset_class ?? null,
        cost_basis_per_share: opts.costBasisPerShare ?? null,
        livePrice,
        liveValue,
        costBasis,
        gainLoss,
        gainLossPct,
      };
    }

    // ── Build Plaid investment account entries ─────────────────────────────
    const itemMap = new Map((plaidItems ?? []).map((i) => [i.item_id, i.institution]));

    const holdingsByPlaid = new Map<string, PlaidHoldingRow[]>();
    for (const h of plaidHoldings ?? []) {
      const arr = holdingsByPlaid.get(h.plaid_account_id) ?? [];
      arr.push(h);
      holdingsByPlaid.set(h.plaid_account_id, arr);
    }

    const plaidResults: AccountWithHoldings[] = (plaidInvAccounts ?? []).map((acct) => {
      const acctHoldings = holdingsByPlaid.get(acct.plaid_account_id) ?? [];
      let liveSum = 0;
      let anyPriced = false;

      const enriched = acctHoldings.map((h) => {
        const holding = enrich({
          id: h.id,
          ticker: h.ticker,
          name: h.name,
          shares: h.quantity ?? 0,
          asset_class: h.asset_class,
          costBasisPerShare: h.cost_basis,
          plaidClosePrice: h.close_price,
        });
        if (holding.liveValue !== null) {
          liveSum += holding.liveValue;
          anyPriced = true;
        }
        return holding;
      });

      // If no holdings priced, fall back to Plaid's sum of values
      const plaidTotalValue = acctHoldings.reduce((s, h) => s + (h.value ?? 0), 0);

      return {
        id: acct.plaid_account_id,
        name: acct.name ?? "Investment Account",
        institution: itemMap.get(acct.item_id) ?? null,
        account_type: acct.account_subtype ?? "investment",
        balance: acct.current_balance ?? 0,
        source: "plaid" as const,
        liveValue: anyPriced ? liveSum : (plaidTotalValue > 0 ? plaidTotalValue : null),
        holdings: enriched,
      };
    });

    // ── Build manual account entries ───────────────────────────────────────
    const holdingsByManual = new Map<string, ManualHoldingRow[]>();
    for (const h of manualHoldings ?? []) {
      const arr = holdingsByManual.get(h.account_id) ?? [];
      arr.push(h);
      holdingsByManual.set(h.account_id, arr);
    }

    const manualResults: AccountWithHoldings[] = (manualAccounts ?? []).map((acct) => {
      const acctHoldings = holdingsByManual.get(acct.id) ?? [];
      let liveSum = 0;
      let anyPriced = false;

      const enriched = acctHoldings.map((h) => {
        const holding = enrich({
          id: h.id,
          ticker: h.ticker,
          name: h.name ?? h.ticker ?? "Unknown",
          shares: h.shares,
          asset_class: h.asset_class,
          costBasisPerShare: h.cost_basis_per_share,
        });
        if (holding.liveValue !== null) {
          liveSum += holding.liveValue;
          anyPriced = true;
        }
        return holding;
      });

      return {
        id: acct.id,
        name: acct.name,
        institution: acct.institution,
        account_type: acct.account_type,
        balance: acct.balance,
        source: "manual" as const,
        liveValue: anyPriced ? liveSum : null,
        holdings: enriched,
      };
    });

    // Plaid accounts first (they're auto-synced and more accurate)
    return NextResponse.json({ accounts: [...plaidResults, ...manualResults] });
  } catch (err) {
    console.error("[holdings-with-prices]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
