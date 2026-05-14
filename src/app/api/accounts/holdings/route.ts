// GET    /api/accounts/holdings?account_id=…  — list holdings for one account
// POST   /api/accounts/holdings               — create or update (upsert by id)
// DELETE /api/accounts/holdings?id=…          — delete one holding

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const accountId = new URL(req.url).searchParams.get("account_id");
    if (!accountId) {
      return NextResponse.json({ error: "account_id required" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manual_holdings")
      .select("id, account_id, ticker, name, shares, cost_basis_per_share, asset_class, updated_at")
      .eq("account_id", accountId)
      .order("ticker");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[holdings GET]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, account_id, ticker, name, shares, cost_basis_per_share, asset_class } = body;

    if (!account_id || !ticker) {
      return NextResponse.json({ error: "account_id and ticker required" }, { status: 400 });
    }

    const supabase = await createClient();
    const row = {
      ...(id ? { id } : {}),
      account_id,
      ticker: ticker.trim().toUpperCase(),
      name: name?.trim() || null,
      shares: Number(shares) || 0,
      cost_basis_per_share: cost_basis_per_share ? Number(cost_basis_per_share) : null,
      asset_class: asset_class ?? "equity",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("manual_holdings")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[holdings POST]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from("manual_holdings").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[holdings DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
