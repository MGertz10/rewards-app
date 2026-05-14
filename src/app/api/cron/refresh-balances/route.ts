// GET /api/cron/refresh-balances
// Runs daily at 6 AM ET via Vercel cron.
// Syncs Plaid balances and transactions for all linked items.

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://rewards-app-tan.vercel.app";
    const res = await fetch(`${base}/api/plaid/sync`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[cron/refresh-balances]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
