// GET  /api/cards/metadata  — load all card metadata rows
// POST /api/cards/metadata  — upsert card metadata rows
// Uses the server-side Supabase client (service role) so writes always succeed.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_card_metadata")
      .select("card_id, opened_date, statement_close_day, due_day, credit_limit, last4, active, cert_expiry, cert_count");

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[cards/metadata GET]", err);
    return NextResponse.json({ error: "Failed to load card metadata" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_card_metadata")
      .upsert(rows, { onConflict: "card_id" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cards/metadata POST]", err);
    return NextResponse.json({ error: "Failed to save card metadata" }, { status: 500 });
  }
}
