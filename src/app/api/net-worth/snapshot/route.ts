// POST /api/net-worth/snapshot — upsert today's net worth snapshot (called by dashboard)
// GET  /api/net-worth/snapshot — returns all historical snapshots (up to 3 years) for the graph

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    // Return up to 3 years of history — seed data goes back to Sep '24
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 3);

    const { data, error } = await supabase
      .from("net_worth_snapshots")
      .select("recorded_date, net_worth, total_assets, total_liabilities")
      .gte("recorded_date", cutoff.toISOString().slice(0, 10))
      .order("recorded_date", { ascending: true });

    if (error) {
      // Table may not exist yet — return empty so UI degrades gracefully
      console.warn("[net-worth/snapshot GET]", error.message);
      return NextResponse.json({ snapshots: [] });
    }

    return NextResponse.json({ snapshots: data ?? [] });
  } catch (err) {
    console.error("[net-worth/snapshot GET]", err);
    return NextResponse.json({ snapshots: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { total_assets, total_liabilities, net_worth, breakdown } = body;

    if (net_worth == null) {
      return NextResponse.json({ error: "net_worth required" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const supabase = await createClient();

    // Server-side sanity floor: reject writes that would drop net_worth by
    // more than 30% relative to the most recent prior snapshot. Such drops
    // almost always indicate a partial-sync data-pipeline bug rather than a
    // real loss, and we'd rather skip the write than corrupt history.
    const { data: prior } = await supabase
      .from("net_worth_snapshots")
      .select("net_worth, recorded_date")
      .lt("recorded_date", today)
      .order("recorded_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prior && prior.net_worth > 0 && net_worth < prior.net_worth * 0.7) {
      console.warn(`[net-worth/snapshot POST] rejected: ${net_worth} < 70% of prior ${prior.net_worth}`);
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: `net_worth ${net_worth} is >30% below prior ${prior.net_worth} — likely a partial sync`,
      });
    }

    const { error } = await supabase.from("net_worth_snapshots").upsert(
      { recorded_date: today, total_assets, total_liabilities, net_worth, breakdown },
      { onConflict: "recorded_date" }
    );

    if (error) {
      console.warn("[net-worth/snapshot POST]", error.message);
      return NextResponse.json({ ok: false, message: error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[net-worth/snapshot POST]", err);
    return NextResponse.json({ ok: false });
  }
}
