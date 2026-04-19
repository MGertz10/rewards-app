"use client";

import { useState } from "react";
import { Search, X, TrendingUp, AlertCircle } from "lucide-react";
import { getMerchantCategory, getCategoryLabel } from "@/lib/merchants";
import { scoreCards, formatPoints, programName, type CardResult } from "@/lib/optimizer";
import type { Category } from "@/lib/cards";

const AMOUNT_OPTIONS = [10, 25, 50, 100, 200];

const QUICK_PICKS = [
  "Chipotle", "Uber", "Whole Foods", "Starbucks", "United Airlines",
  "Walgreens", "Trader Joe's", "Netflix", "Marriott", "Shell",
];

export default function OptimizerPage() {
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [results, setResults] = useState<CardResult[] | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<{ category: Category; label: string } | null>(null);

  function handleSearch(input: string) {
    setQuery(input);
    if (!input.trim()) {
      setResults(null);
      setDetectedCategory(null);
      return;
    }
    const match = getMerchantCategory(input);
    if (match) {
      setDetectedCategory(match);
      const scored = scoreCards(match.category, amount);
      setResults(scored);
    } else {
      setDetectedCategory(null);
      // Show catch-all results
      const scored = scoreCards("other", amount);
      setResults(scored);
    }
  }

  function handleAmountChange(val: number) {
    setAmount(val);
    setCustomAmount("");
    if (detectedCategory) {
      setResults(scoreCards(detectedCategory.category, val));
    }
  }

  function handleCustomAmount(val: string) {
    setCustomAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
      if (detectedCategory) {
        setResults(scoreCards(detectedCategory.category, num));
      }
    }
  }

  function handleCategoryOverride(category: Category) {
    const label = getCategoryLabel(category);
    setDetectedCategory({ category, label });
    setResults(scoreCards(category, amount));
  }

  const bestResult = results?.[0];

  return (
    <div className="flex flex-col min-h-screen px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Card Optimizer</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Which card should I use?</p>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Merchant or category (e.g. Chipotle, gas)"
          className="w-full rounded-2xl border border-border bg-card pl-10 pr-10 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults(null); setDetectedCategory(null); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Amount Selector */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Purchase Amount</p>
        <div className="flex gap-2 flex-wrap">
          {AMOUNT_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAmountChange(opt)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                amount === opt && !customAmount
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-foreground hover:bg-muted"
              }`}
            >
              ${opt}
            </button>
          ))}
          <input
            type="number"
            value={customAmount}
            onChange={(e) => handleCustomAmount(e.target.value)}
            placeholder="Custom"
            className={`w-20 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              customAmount
                ? "bg-primary text-white border-primary placeholder:text-white/70"
                : "bg-card border-border text-foreground placeholder:text-muted-foreground"
            }`}
          />
        </div>
      </div>

      {/* Detected Category Badge */}
      {detectedCategory && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Detected:</span>
          <span className="text-xs font-semibold bg-accent text-primary px-2.5 py-1 rounded-full">
            {detectedCategory.label}
          </span>
          <span className="text-xs text-muted-foreground">— not right?</span>
          <button
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => {
              setDetectedCategory(null);
              setResults(null);
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* No match — category picker */}
      {query && !detectedCategory && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle size={16} className="text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Couldn't auto-detect the category for <strong>{query}</strong>. Pick one:
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["dining","groceries","gas","travel","flight","hotel","rental_car","streaming","drugstore","marriott","other"] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryOverride(cat)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-muted text-foreground hover:bg-accent hover:text-primary transition-colors border border-border"
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Best card for ${amount} {detectedCategory ? `at ${detectedCategory.label}` : "purchase"}
          </p>

          {results.map((r, i) => (
            <CardResultRow key={r.card.id} result={r} index={i} />
          ))}

          <p className="text-xs text-muted-foreground text-center mt-1 px-4">
            Values estimated using {results[0].cpp}¢/pt for {programName(results[0].card)}
          </p>
        </div>
      )}

      {/* Quick Picks (shown when no query) */}
      {!query && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Picks</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PICKS.map((pick) => (
              <button
                key={pick}
                onClick={() => handleSearch(pick)}
                className="px-3 py-1.5 rounded-xl text-sm bg-card border border-border text-foreground hover:bg-accent hover:text-primary transition-colors"
              >
                {pick}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardResultRow({ result, index }: { result: CardResult; index: number }) {
  const { card, multiplier, pointsEarned, dollarValue, note, rank } = result;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        rank === "best"
          ? "border-primary/30 bg-accent shadow-sm"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Card chip */}
        <div
          className="w-12 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: card.color, color: card.textColor }}
        >
          {card.shortName}
        </div>

        {/* Card info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
            {rank === "best" && (
              <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full shrink-0">
                BEST
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {multiplier}x · {formatPoints(pointsEarned)} pts
            {note && ` · ${note}`}
          </p>
        </div>

        {/* Value */}
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-foreground">${dollarValue.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">est. value</p>
        </div>
      </div>

      {/* Best card highlight bar */}
      {rank === "best" && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-1.5">
          <TrendingUp size={13} className="text-primary" />
          <p className="text-xs text-primary font-medium">
            Use this card — earns {multiplier}x {card.pointsProgram === "chase_ur" ? "Chase UR" : card.pointsProgram === "capital_one" ? "Capital One Miles" : "Marriott Points"}
          </p>
        </div>
      )}
    </div>
  );
}
