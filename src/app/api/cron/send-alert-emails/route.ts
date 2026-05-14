// GET /api/cron/send-alert-emails
// Runs daily at 8 AM ET. Sends unsent alerts as an email digest via Resend.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAlertDigest } from "@/lib/email";
import type { Alert } from "@/lib/alerts";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Fetch today's unsent, un-dismissed alerts
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { data: rows, error } = await supabase
      .from("alerts")
      .select("*")
      .is("sent_email_at", null)
      .is("dismissed_at", null)
      .gte("created_at", since.toISOString())
      .order("severity", { ascending: true }); // high first

    if (error) throw error;

    const alerts: Alert[] = (rows ?? []).map((r) => ({
      type: r.type,
      severity: r.severity,
      title: r.title,
      body: r.body ?? "",
      due_at: r.due_at,
      payload: r.payload ?? {},
    }));

    await sendAlertDigest(alerts);

    // Mark as sent
    if (rows && rows.length > 0) {
      await supabase
        .from("alerts")
        .update({ sent_email_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));
    }

    return NextResponse.json({ ok: true, sent: alerts.length });
  } catch (err) {
    console.error("[cron/send-alert-emails]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
