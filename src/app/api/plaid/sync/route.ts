// POST /api/plaid/sync
// Syncs balances and transactions for all linked Plaid items (or a specific item_id).
// Called by: cron/refresh-balances, plaid/exchange (post-link), manual "Refresh" button.

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/encrypt";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetItemId: string | undefined = body.item_id;

    const supabase = await createClient();

    // Load Plaid items
    let query = supabase.from("plaid_items").select("*");
    if (targetItemId) query = query.eq("item_id", targetItemId);
    const { data: items, error: itemsErr } = await query;
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) {
      return NextResponse.json({ ok: true, message: "No linked accounts" });
    }

    const results: { item_id: string; accounts: number; holdingsCount?: number; error?: string; txError?: string }[] = [];

    for (const item of items) {
      try {
        const accessToken = await decrypt(item.access_token_encrypted);

        // ── Accounts + Balances ─────────────────────────────────────────────
        // accountsGet works for all account types (banking + investment) with cached balances.
        // accountsBalanceGet does a live institution call but fails for investment accounts
        // and can time out on first sync. We try real-time first, fall back to cached.
        let accounts;
        try {
          const balRes = await plaidClient.accountsBalanceGet({ access_token: accessToken });
          accounts = balRes.data.accounts;
        } catch {
          const acctRes = await plaidClient.accountsGet({ access_token: accessToken });
          accounts = acctRes.data.accounts;
        }

        for (const acct of accounts) {
          const utilPct =
            acct.balances.limit && acct.balances.current != null
              ? (acct.balances.current / acct.balances.limit) * 100
              : null;

          const { error: balErr } = await supabase.from("card_balances").upsert(
            {
              plaid_account_id: acct.account_id,
              item_id: item.item_id,
              name: acct.name,
              mask: acct.mask,
              current_balance: acct.balances.current,
              available_balance: acct.balances.available,
              credit_limit: acct.balances.limit,
              utilization_pct: utilPct ? Math.round(utilPct * 10) / 10 : null,
              account_type: acct.type ?? null,
              account_subtype: acct.subtype ?? null,
              as_of: new Date().toISOString(),
            },
            { onConflict: "plaid_account_id" }
          );
          if (balErr) {
            console.error(`[plaid/sync] card_balances upsert failed for ${acct.account_id}:`, balErr);
            throw new Error(`card_balances upsert: ${balErr.message}`);
          }
        }

        // ── Transactions (cursor-based incremental sync) ────────────────────
        // Wrapped in its own try/catch — investment/benefits accounts don't support
        // the Transactions product and will throw PRODUCTS_NOT_SUPPORTED. We still
        // want to save account balances even if transactions can't be synced.
        let txError: string | undefined;
        try {
          let cursor: string | undefined = item.cursor ?? undefined;
          let hasMore = true;

          while (hasMore) {
            const txRes = await plaidClient.transactionsSync({
              access_token: accessToken,
              cursor,
            });
            const { added, modified, removed, next_cursor, has_more } = txRes.data;

            // Insert / update added transactions
            for (const tx of [...added, ...modified]) {
              const { error: txUpsertErr } = await supabase.from("transactions").upsert(
                {
                  plaid_tx_id: tx.transaction_id,
                  plaid_account_id: tx.account_id,
                  item_id: item.item_id,
                  posted_at: tx.date,
                  amount: tx.amount,
                  merchant_raw: tx.merchant_name ?? tx.name,
                  category: tx.personal_finance_category?.primary ?? null,
                  pending: tx.pending,
                },
                { onConflict: "plaid_tx_id" }
              );
              if (txUpsertErr) {
                console.error(`[plaid/sync] transactions upsert failed for ${tx.transaction_id}:`, txUpsertErr);
                throw new Error(`transactions upsert: ${txUpsertErr.message}`);
              }
            }

            // Remove deleted transactions
            for (const r of removed) {
              await supabase.from("transactions").delete().eq("plaid_tx_id", r.transaction_id);
            }

            cursor = next_cursor;
            hasMore = has_more;
          }

          // Save updated cursor
          await supabase
            .from("plaid_items")
            .update({ cursor, updated_at: new Date().toISOString() })
            .eq("item_id", item.item_id);
        } catch (txErr: unknown) {
          // Investment/benefits accounts don't support transactions — log but don't fail
          txError = String(txErr);
          console.warn(`[plaid/sync] transactions skipped for ${item.item_id}:`, txError);
          // Still update updated_at so the item shows as synced
          await supabase
            .from("plaid_items")
            .update({ updated_at: new Date().toISOString() })
            .eq("item_id", item.item_id);
        }

        // ── Investment Holdings (Plaid Investments product) ─────────────────
        // Only runs if this item was linked with Products.Investments.
        // Stores individual positions in plaid_holdings for portfolio view.
        let holdingsCount = 0;
        try {
          const holdingsRes = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });
          const { holdings, securities } = holdingsRes.data;

          // Build security lookup: security_id → { ticker, name, type }
          const secMap = new Map(securities.map((s) => [s.security_id, s]));

          for (const h of holdings) {
            const sec = secMap.get(h.security_id);
            const { error: holdErr } = await supabase.from("plaid_holdings").upsert(
              {
                plaid_account_id: h.account_id,
                item_id: item.item_id,
                ticker: sec?.ticker_symbol ?? null,
                name: sec?.name ?? "Unknown",
                quantity: h.quantity,
                close_price: h.institution_price ?? null,
                cost_basis: h.cost_basis ?? null,
                value: h.institution_value ?? null,
                asset_class: sec?.type ?? null,
                as_of: new Date().toISOString(),
              },
              { onConflict: "plaid_account_id, name" }
            );
            if (holdErr) {
              console.warn(`[plaid/sync] plaid_holdings upsert failed for ${h.account_id}:`, holdErr);
              // Don't throw — holdings are optional; balance sync should still succeed
            } else {
              holdingsCount++;
            }
          }
        } catch {
          // Item doesn't have Investments product — skip silently
        }

        results.push({ item_id: item.item_id, accounts: accounts.length, holdingsCount, ...(txError ? { txError } : {}) });
      } catch (itemErr) {
        console.error(`[plaid/sync] item ${item.item_id}`, itemErr);
        results.push({ item_id: item.item_id, accounts: 0, error: String(itemErr) });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[plaid/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
