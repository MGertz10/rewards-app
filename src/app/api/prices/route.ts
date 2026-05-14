// GET /api/prices?tickers=FXAIX,AAPL,BRK.B
// Fetches real-time quotes from Yahoo Finance (free, no API key).
// Cached for 5 minutes via Next.js revalidation.

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  if (tickers.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const prices: Record<string, number | null> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; rewards-app/1.0)",
            Accept: "application/json",
          },
          next: { revalidate: 300 }, // 5-min cache
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const price: number | undefined =
          data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        prices[ticker] = price ?? null;
      } catch (err) {
        console.warn(`[prices] ${ticker}:`, err);
        prices[ticker] = null;
      }
    })
  );

  return NextResponse.json(
    { prices },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
