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

    // Immediately kick off a balance sync so dashboard shows data right away.
    // Must use an absolute URL — relative URLs don't work in server-side fetch.
    const reqUrl = new URL(req.url);
    const base = `${reqUrl.protocol}//${reqUrl.host}`;
    fetch(`${base}/api/plaid/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id }),
    }).catch(() => {}); // fire-and-forget

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[plaid/exchange]", err);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}
