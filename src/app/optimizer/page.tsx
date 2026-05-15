"use client";

import { useEffect, useState } from "react";
import { Search, X, ChevronRight, Zap, Lightbulb } from "lucide-react";
import { getMerchantCategory, getCategoryLabel } from "@/lib/merchants";
import { scoreCards, formatPoints, type CardResult } from "@/lib/optimizer";
import { CARDS } from "@/lib/cards";
import type { Category } from "@/lib/cards";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/client";

// ─── Quick picks — real-world use cases ────────────────────────────────────

const QUICK_PICKS: { label: string; query: string }[] = [
  { label: "Restaurant",   query: "restaurant" },
  { label: "Groceries",    query: "Whole Foods" },
  { label: "Coffee",       query: "Starbucks"   },
  { label: "Uber / Lyft",  query: "Uber"        },
  { label: "Gas",          query: "Shell"       },
  { label: "Flight",       query: "United"      },
  { label: "Hotel",        query: "Marriott"    },
  { label: "Amazon",       query: "Amazon"      },
  { label: "Pharmacy",     query: "Walgreens"   },
  { label: "Streaming",    query: "Netflix"     },
];

// ─── Category override picker ──────────────────────────────────────────────

const CAT_OVERRIDES: { label: string; cat: Category }[] = [
  { label: "Dining",       cat: "dining"      },
  { label: "Groceries",    cat: "groceries"   },
  { label: "Travel",       cat: "travel"      },
  { label: "Gas",          cat: "gas"         },
  { label: "Flight",       cat: "flight"      },
  { label: "Hotel",        cat: "hotel"       },
  { label: "Car Rental",   cat: "rental_car"  },
  { label: "Streaming",    cat: "streaming"   },
  { label: "Pharmacy",     cat: "drugstore"   },
  { label: "Other",        cat: "other"       },
];

// ─── Amount presets ────────────────────────────────────────────────────────

const AMOUNTS = [25, 50, 100, 200];

// ─── Card color lookup ─────────────────────────────────────────────────────

function getCardGradient(cardId: string): { bg: string; text: string } {
  switch (cardId) {
    case "cfu":        return { bg: "#0f62a8", text: "#ffffff" };
    case "csp":        return { bg: "#1a3a6b", text: "#ffffff" };
    case "boundless":  return { bg: "#8b0000", text: "#ffffff" };
    case "venture_x":  return { bg: "#b91c1c", text: "#ffffff" };
    default:           return { bg: "#1a1a2e", text: "#ffffff" };
  }
}

// ─── Recent transaction insight ────────────────────────────────────────────

interface RecentMerchant {
  merchant: string;
  category: string | null;
  accountName: string | null;
}

function guessCardId(name: string | null): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("freedom unlimited") || n.includes("freedom un")) return "cfu";
  if (n.includes("sapphire preferred")) return "csp";
  if (n.includes("boundless") || (n.includes("marriott") && n.includes("chase"))) return "boundless";
  if (n.includes("venture x") || n.includes("capital one")) return "venture_x";
  return null;
}

// ─── Missed value helper ───────────────────────────────────────────────────

function missedValue(results: CardResult[]): { card: string; extra: number } | null {
  if (results.length < 2) return null;
  const best = results[0];
  const second = results[1];
  const diff = best.dollarValue - second.dollarValue;
  if (diff < 0.05) return null;
  return { card: second.card.shortName, extra: diff };
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function OptimizerPage() {
  const [query, setQuery]         = useState("");
  const [amount, setAmount]       = useState(50);
  const [customAmt, setCustomAmt] = useState("");
  const [results, setResults]     = useState<CardResult[] | null>(null);
  const [detectedCat, setDetectedCat] = useState<{ category: Category; label: string } | null>(null);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [recentMerchants, setRecentMerchants] = useState<RecentMerchant[]>([]);

  // Load recent merchants from Plaid transactions
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("transactions")
        .select("merchant_raw,category,plaid_account_id")
        .eq("pending", false)
        .gt("amount", 0)
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS","INCOME")')
        .order("posted_at", { ascending: false })
        .limit(20),
      supabase.from("card_balances").select("plaid_account_id,name"),
    ]).then(([{ data: txs }, { data: accts }]) => {
      if (!txs || !accts) return;
      const acctMap = Object.fromEntries(accts.map(a => [a.plaid_account_id, a.name]));
      // Deduplicate by merchant
      const seen = new Set<string>();
      const recent: RecentMerchant[] = [];
      for (const tx of txs) {
        const m = tx.merchant_raw;
        if (!m || seen.has(m)) continue;
        seen.add(m);
        recent.push({
          merchant: m,
          category: tx.category,
          accountName: acctMap[tx.plaid_account_id] ?? null,
        });
        if (recent.length >= 5) break;
      }
      setRecentMerchants(recent);
    });
  }, []);

  function runSearch(input: string, amt?: number) {
    const searchAmt = amt ?? amount;
    const q = input.trim();
    if (!q) { setResults(null); setDetectedCat(null); setShowCatPicker(false); return; }

    const match = getMerchantCategory(q);
    if (match) {
      setDetectedCat(match);
      setResults(scoreCards(match.category, searchAmt));
      setShowCatPicker(false);
    } else {
      setDetectedCat(null);
      setResults(scoreCards("other", searchAmt));
      setShowCatPicker(true);
    }
  }

  function handleSearch(input: string) {
    setQuery(input);
    runSearch(input);
  }

  function setAmt(val: number) {
    setAmount(val);
    setCustomAmt("");
    if (detectedCat) setResults(scoreCards(detectedCat.category, val));
  }

  function handleCustomAmt(val: string) {
    setCustomAmt(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setAmount(n);
      if (detectedCat) setResults(scoreCards(detectedCat.category, n));
    }
  }

  function overrideCategory(cat: Category) {
    const label = getCategoryLabel(cat);
    setDetectedCat({ category: cat, label });
    setResults(scoreCards(cat, amount));
    setShowCatPicker(false);
  }

  function clear() {
    setQuery(""); setResults(null); setDetectedCat(null); setShowCatPicker(false);
  }

  const best   = results?.[0];
  const others = results?.slice(1) ?? [];
  const missed = results ? missedValue(results) : null;
  const colors = best ? getCardGradient(best.card.id) : null;

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Card Optimizer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Get the right card, right now.</p>
      </div>

      {/* Search */}
      <div className="px-4 relative mb-4">
        <Search size={17} className="absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Merchant or category…"
          className="w-full rounded-2xl border border-border bg-card pl-10 pr-10 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button onClick={clear}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Amount chips */}
      <div className="px-4 mb-5">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Purchase Amount</p>
        <div className="flex gap-2 flex-wrap">
          {AMOUNTS.map(opt => (
            <button key={opt} onClick={() => setAmt(opt)}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                amount === opt && !customAmt
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              ${opt}
            </button>
          ))}
          <input
            type="number"
            value={customAmt}
            onChange={e => handleCustomAmt(e.target.value)}
            placeholder="Custom"
            className={`w-20 px-3 py-1.5 rounded-xl text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              customAmt ? "bg-primary text-white border-primary" : "bg-muted border-transparent text-muted-foreground"
            }`}
          />
        </div>
      </div>

      {/* Detected category + override */}
      {detectedCat && (
        <div className="px-4 mb-4 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Detected:</span>
          <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {detectedCat.label}
          </span>
          <button onClick={() => setShowCatPicker(p => !p)}
            className="text-[11px] text-muted-foreground underline underline-offset-2">
            change
          </button>
        </div>
      )}

      {/* Category override picker */}
      {showCatPicker && (
        <div className="px-4 mb-4">
          <p className="text-[11px] text-muted-foreground mb-2">Select the category:</p>
          <div className="flex flex-wrap gap-2">
            {CAT_OVERRIDES.map(({ label, cat }) => (
              <button key={cat} onClick={() => overrideCategory(cat)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-foreground hover:bg-primary hover:text-white transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULT: Best card hero ─────────────────────────────────────── */}
      {best && colors && (
        <div className="px-4 flex flex-col gap-3">

          {/* Hero */}
          <div className="rounded-3xl p-6 shadow-xl" style={{ background: colors.bg }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
              style={{ color: colors.text + "99" }}>
              Use This Card
            </p>
            <p className="text-2xl font-extrabold leading-tight" style={{ color: colors.text }}>
              {best.card.name}
            </p>

            <div className="flex items-baseline gap-1.5 mt-3">
              <span className="text-5xl font-black" style={{ color: colors.text }}>
                {best.multiplier}x
              </span>
              <span style={{ color: colors.text + "99" }} className="text-base font-semibold">
                {best.card.pointsProgram === "chase_ur"
                  ? "Chase UR"
                  : best.card.pointsProgram === "capital_one"
                  ? "CapOne Miles"
                  : "Marriott Pts"}
              </span>
            </div>

            <div className="flex justify-between mt-5 pt-4 border-t"
              style={{ borderColor: colors.text + "25" }}>
              <div>
                <p className="text-[11px] font-semibold mb-1" style={{ color: colors.text + "80" }}>
                  Points Earned
                </p>
                <p className="text-xl font-extrabold" style={{ color: colors.text }}>
                  +{formatPoints(best.pointsEarned)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold mb-1" style={{ color: colors.text + "80" }}>
                  Est. Value
                </p>
                <p className="text-xl font-extrabold" style={{ color: colors.text }}>
                  ${best.dollarValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Missed value callout */}
          {missed && (
            <div className="flex items-center gap-2 px-1">
              <Lightbulb size={13} className="text-amber-500 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                vs {missed.card}: earns <span className="font-bold text-foreground">
                  ${missed.extra.toFixed(2)} more
                </span> — worth switching
              </p>
            </div>
          )}

          {/* Other cards comparison */}
          {others.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-3 pb-1.5">
                Other cards
              </p>
              {others.map((r, i) => (
                <div key={r.card.id}
                  className="flex items-center gap-3 px-4 py-3 border-t border-border/50 first:border-0">
                  <div className="w-11 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: r.card.color, color: r.card.textColor }}>
                    {r.card.shortName}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{r.card.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.multiplier}x · {formatPoints(r.pointsEarned)} pts
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-muted-foreground shrink-0">${r.dollarValue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pb-2">
            Using {best.cpp}¢/pt for {best.card.pointsProgram === "chase_ur" ? "Chase UR" : best.card.pointsProgram === "capital_one" ? "Capital One" : "Marriott Bonvoy"}
          </p>
        </div>
      )}

      {/* ── NO RESULTS: Quick picks ───────────────────────────────────── */}
      {!results && (
        <div className="px-4 flex flex-col gap-5">

          {/* Quick picks */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Quick Picks
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PICKS.map(({ label, query: q }) => (
                <button key={label} onClick={() => handleSearch(q)}
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-left flex items-center justify-between hover:bg-muted/60 transition-colors group">
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent merchants from real transactions */}
          {recentMerchants.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Your Recent Merchants
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {recentMerchants.map((rm, i) => {
                  const cardId = guessCardId(rm.accountName);
                  const card = CARDS.find(c => c.id === cardId);
                  return (
                    <button key={i} onClick={() => handleSearch(rm.merchant)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{rm.merchant}</p>
                        {card && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Paid on {card.shortName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {card && (
                          <div className="w-10 h-6 rounded-md flex items-center justify-center text-[8px] font-bold"
                            style={{ backgroundColor: card.color, color: card.textColor }}>
                            {card.shortName}
                          </div>
                        )}
                        <Zap size={13} className="text-primary" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                Tap any merchant to see if you&apos;re using the best card.
              </p>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
