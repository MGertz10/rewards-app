// GET  /api/feature-ideas         — list all ideas
// POST /api/feature-ideas         — create new idea
// PATCH /api/feature-ideas        — update status { id, status }
// DELETE /api/feature-ideas?id=   — delete idea

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEED: { title: string; category: string; status: string }[] = [
  // Dashboard
  { title: "Card recommendation on recent transactions (\"should have used X card\")", category: "Dashboard", status: "idea" },
  { title: "Real estate fund correctly categorized (not 'real estate')", category: "Dashboard", status: "idea" },
  { title: "Net worth projection / trajectory line on graph", category: "Dashboard", status: "idea" },
  // Strategy Hub
  { title: "Marriott Boundless → Bonvoy Bold downgrade workflow", category: "Strategy Hub", status: "idea" },
  { title: "Annual fee calendar (when fees hit, keep/cancel/downgrade)", category: "Strategy Hub", status: "idea" },
  { title: "General card downgrade path engine", category: "Strategy Hub", status: "idea" },
  { title: "Points expiry & burn tracker", category: "Strategy Hub", status: "idea" },
  { title: "Credit score optimizer", category: "Strategy Hub", status: "idea" },
  { title: "Payment timing automation", category: "Strategy Hub", status: "idea" },
  { title: "Spend velocity alerts", category: "Strategy Hub", status: "idea" },
  { title: "Current SUB (sign-up bonus) offers scanner", category: "Strategy Hub", status: "idea" },
  { title: "Transfer bonus promotions display", category: "Strategy Hub", status: "idea" },
  { title: "Card comparison mode", category: "Strategy Hub", status: "idea" },
  { title: "\"Cards to consider\" based on spend profile", category: "Strategy Hub", status: "idea" },
  { title: "Live CPP normalization across all points programs", category: "Strategy Hub", status: "idea" },
  // Trip Planner
  { title: "Destination + dates → ranked redemption options", category: "Trip Planner", status: "idea" },
  { title: "Transfer partner comparison with CPP values", category: "Trip Planner", status: "idea" },
  { title: "Portal vs transfer vs cash comparison tool", category: "Trip Planner", status: "idea" },
  { title: "London NYE trip optimizer (102K Venture X miles, 11K Chase UR)", category: "Trip Planner", status: "idea" },
  { title: "Europe 2026 trip planner (Austria/Prague/Budapest or Greece/Croatia)", category: "Trip Planner", status: "idea" },
  { title: "Marriott free night cert deployment tool (5 certs to use)", category: "Trip Planner", status: "idea" },
  { title: "Mistake fare / flash sale alerts", category: "Trip Planner", status: "idea" },
  // Cards
  { title: "Card optimizer — which card for this purchase", category: "Cards", status: "idea" },
  { title: "Live points balances synced to programs", category: "Cards", status: "idea" },
  { title: "Active multipliers by spend category", category: "Cards", status: "idea" },
  // Infrastructure
  { title: "Email alert digest via Resend", category: "Infrastructure", status: "idea" },
  { title: "Card data model extensions (openedDate, annualFee, feeMonth, statementCloseDay, dueDay)", category: "Infrastructure", status: "idea" },
  { title: "Live points/promo data pipeline (not hardcoded CPP values)", category: "Infrastructure", status: "idea" },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_ideas")
      .select("*")
      .order("category")
      .order("created_at");
    if (error) throw error;

    // Seed on first load if table is empty
    if (!data || data.length === 0) {
      const { error: seedErr } = await supabase.from("feature_ideas").insert(SEED);
      if (seedErr) throw seedErr;
      const { data: seeded } = await supabase
        .from("feature_ideas").select("*").order("category").order("created_at");
      return NextResponse.json({ data: seeded ?? [] });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[feature-ideas GET]", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, category } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_ideas")
      .insert({ title: title.trim(), category: category?.trim() || "General", status: "idea" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[feature-ideas POST]", err);
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, title } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const supabase = await createClient();
    const updates: Record<string, string> = {};
    if (status) updates.status = status;
    if (title) updates.title = title.trim();
    const { error } = await supabase.from("feature_ideas").update(updates).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feature-ideas PATCH]", err);
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const supabase = await createClient();
    const { error } = await supabase.from("feature_ideas").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feature-ideas DELETE]", err);
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
