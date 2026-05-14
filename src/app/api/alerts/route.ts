// GET  /api/alerts        — returns recent undismissed alerts (last 7 days)
// PATCH /api/alerts?id=…  — marks a single alert as dismissed
// DELETE /api/alerts?id=all — clears all dismissed state (mark all as seen)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("alerts")
      .select("id, type, severity, title, body, due_at, dismissed_at, sent_email_at, created_at, payload")
      .is("dismissed_at", null)
      .gte("created_at", since.toISOString())
      .order("severity", { ascending: true }) // high first (alphabetical: high < low < medium — use custom sort client-side)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Sort by severity weight: high → medium → low → info
    const WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
    const sorted = (data ?? []).sort(
      (a, b) => (WEIGHT[a.severity] ?? 9) - (WEIGHT[b.severity] ?? 9)
    );

    return NextResponse.json({ alerts: sorted });
  } catch (err) {
    console.error("[api/alerts GET]", err);
    return NextResponse.json({ alerts: [] });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/alerts PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("id") !== "all") {
    return NextResponse.json({ error: "Use ?id=all" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);
    await supabase
      .from("alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .is("dismissed_at", null)
      .gte("created_at", since.toISOString());

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/alerts DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
