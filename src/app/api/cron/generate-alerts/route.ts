// GET /api/cron/generate-alerts
// Runs daily at 7 AM ET. Generates today's alerts and writes to Supabase.

import { NextResponse } from "next/server";
import { generateAllAlerts } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alerts = generateAllAlerts();
    if (alerts.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const supabase = await createClient();
    const { error, count } = await supabase.from("alerts").insert(
      alerts.map((a) => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
        body: a.body,
        due_at: a.due_at,
        payload: a.payload,
      }))
    );

    if (error) throw error;
    return NextResponse.json({ ok: true, inserted: count ?? alerts.length });
  } catch (err) {
    console.error("[cron/generate-alerts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
