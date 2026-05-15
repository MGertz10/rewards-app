// POST /api/plaid/exchange
// Exchanges a public_token for an access_token, encrypts it, and stores in Supabase.

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { encrypt } from "@/lib/encrypt";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { public_token, institution_name } = await req.json();

    // Exchange public token for access token
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    // Encrypt before storing
    const encryptedToken = await encrypt(access_token);

    const supabase = await createClient();
    const { error } = await supabase.from("plaid_items").upsert(
      {
        item_id,
        access_token_encrypted: encryptedToken,
        institution: institution_name ?? "Unknown",
        cursor: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "item_id" }
    );

    if (error) throw error;

    // Immediately sync balances + transactions so the dashboard shows data right away.
    // MUST be awaited — Vercel serverless kills background (fire-and-forget) fetches
    // the moment the function returns its response.
    const reqUrl = new URL(req.url);
    const base = `${reqUrl.protocol}//${reqUrl.host}`;
    try {
      await fetch(`${base}/api/plaid/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id }),
      });
    } catch (syncErr) {
      // Sync failure is non-fatal — token is saved, cron will retry at 11 UTC
      console.warn("[plaid/exchange] initial sync failed:", syncErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[plaid/exchange]", err);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}
