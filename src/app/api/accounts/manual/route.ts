// GET    /api/accounts/manual        — list all manual accounts
// POST   /api/accounts/manual        — create or update (upsert by id)
// DELETE /api/accounts/manual?id=… — delete one account

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, notes, updated_at")
      .order("account_type")
      .order("name");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[manual-accounts GET]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, institution, account_type, balance, notes } = body;

    const supabase = await createClient();
    const row = {
      ...(id ? { id } : {}),
      name: name?.trim() ?? "",
      institution: institution?.trim() ?? "",
      account_type: account_type ?? "other",
      balance: Number(balance) || 0,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("manual_accounts")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[manual-accounts POST]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = await Promise.resolve(new URL(req.url));
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from("manual_accounts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[manual-accounts DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
