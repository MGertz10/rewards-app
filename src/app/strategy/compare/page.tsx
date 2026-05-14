"use client";

import { useState } from "react";
import { Check, X, CheckCircle2 } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";

// ─── Card data ────────────────────────────────────────────────────────────────

interface CompareCard {
  id: string;
  name: string;
  shortName: string;
  issuer: string;
  owned: boolean;
  annualFee: number;
  pointsCurrency: string;
  diningRate: number;
  travelRate: number;
  everythingRate: number;
  transferPartners: string[];
  bestCPP: number;
  loungeAccess: boolean;
  travelCredit: number;
  noFTF: boolean;
  sweetSpot: string;
  color: string;
  textColor: string;
}

const COMPARE_CARDS: CompareCard[] = [
  {
    id: "cfu", name: "Freedom Unlimited", shortName: "CFU", issuer: "Chase", owned: true,
    annualFee: 0, pointsCurrency: "Chase UR", diningRate: 3, travelRate: 5, everythingRate: 1.5,
    transferPartners: ["Hyatt", "United", "BA", "Singapore", "IHG"],
    bestCPP: 2.0, loungeAccess: false, travelCredit: 0, noFTF: false,
    sweetSpot: "Hyatt transfers (2cpp+) stacked with CSP/CSR",
    color: "#117ACA", textColor: "#fff",
  },
  {
    id: "csp", name: "Sapphire Preferred", shortName: "CSP", issuer: "Chase", owned: true,
    annualFee: 95, pointsCurrency: "Chase UR", diningRate: 3, travelRate: 2, everythingRate: 1,
    transferPartners: ["Hyatt", "United", "BA", "Singapore", "IHG", "Marriott"],
    bestCPP: 2.0, loungeAccess: false, travelCredit: 50, noFTF: true,
    sweetSpot: "Hyatt cat 1–4 (500 pts/night), Turkish C&M",
    color: "#1a3a6b", textColor: "#fff",
  },
  {
    id: "boundless", name: "Bonvoy Boundless", shortName: "Boundless", issuer: "Chase", owned: true,
    annualFee: 95, pointsCurrency: "Marriott Bonvoy", diningRate: 2, travelRate: 2, everythingRate: 2,
    transferPartners: ["40+ airlines (60k Bonvoy = 25k airline pts)"],
    bestCPP: 0.9, loungeAccess: false, travelCredit: 0, noFTF: false,
    sweetSpot: "Free night cert (up to 35k pts/night)",
    color: "#8B1A1A", textColor: "#fff",
  },
  {
    id: "venturex", name: "Venture X", shortName: "Venture X", issuer: "Capital One", owned: true,
    annualFee: 395, pointsCurrency: "Cap1 Miles", diningRate: 2, travelRate: 10, everythingRate: 2,
    transferPartners: ["Turkish", "Air Canada", "Avianca", "Wyndham", "Accor"],
    bestCPP: 1.7, loungeAccess: true, travelCredit: 300, noFTF: true,
    sweetSpot: "Turkish C&M biz transatlantic (70k miles)",
    color: "#4B0082", textColor: "#fff",
  },
  {
    id: "bilt", name: "Bilt Mastercard", shortName: "Bilt", issuer: "Wells Fargo", owned: false,
    annualFee: 0, pointsCurrency: "Bilt Points", diningRate: 3, travelRate: 2, everythingRate: 1,
    transferPartners: ["Hyatt", "United", "AA", "Alaska", "IHG"],
    bestCPP: 2.1, loungeAccess: false, travelCredit: 0, noFTF: true,
    sweetSpot: "Hyatt transfers + rent on card (1x, no fee)",
    color: "#2d2d2d", textColor: "#fff",
  },
  {
    id: "amex-gold", name: "Gold Card", shortName: "Amex Gold", issuer: "American Express", owned: false,
    annualFee: 250, pointsCurrency: "Amex MR", diningRate: 4, travelRate: 3, everythingRate: 1,
    transferPartners: ["Delta", "BA", "Air France/KLM", "Hilton", "Marriott"],
    bestCPP: 2.0, loungeAccess: false, travelCredit: 120, noFTF: true,
    sweetSpot: "Air France FlyingBlue promo (2–2.5cpp)",
    color: "#C9A227", textColor: "#000",
  },
];

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKey =
  | "annualFee" | "pointsCurrency" | "diningRate" | "travelRate"
  | "everythingRate" | "bestCPP" | "loungeAccess" | "travelCredit"
  | "noFTF" | "sweetSpot" | "transferPartners";

interface Row { key: RowKey; label: string }

const ROWS: Row[] = [
  { key: "annualFee",        label: "Annual Fee" },
  { key: "pointsCurrency",   label: "Points Currency" },
  { key: "diningRate",       label: "Dining" },
  { key: "travelRate",       label: "Travel / Portal" },
  { key: "everythingRate",   label: "Everything Else" },
  { key: "bestCPP",          label: "Best CPP est." },
  { key: "loungeAccess",     label: "Lounge Access" },
  { key: "travelCredit",     label: "Travel Credit" },
  { key: "noFTF",            label: "No FTF" },
  { key: "sweetSpot",        label: "Sweet Spot" },
  { key: "transferPartners", label: "Transfer Partners" },
];

function renderCell(card: CompareCard, key: RowKey, allCards: CompareCard[]): React.ReactNode {
  switch (key) {
    case "annualFee":
      return card.annualFee === 0 ? (
        <span className="text-success font-semibold">$0</span>
      ) : (
        <span className="text-foreground font-semibold">${card.annualFee}</span>
      );
    case "pointsCurrency":
      return <span className="text-[10px] font-medium text-foreground">{card.pointsCurrency}</span>;
    case "diningRate": {
      const best = Math.max(...allCards.map((c) => c.diningRate));
      return (
        <span className={card.diningRate === best ? "text-success font-bold" : "text-foreground font-semibold"}>
          {card.diningRate}x
        </span>
      );
    }
    case "travelRate": {
      const best = Math.max(...allCards.map((c) => c.travelRate));
      return (
        <span className={card.travelRate === best ? "text-success font-bold" : "text-foreground font-semibold"}>
          {card.travelRate}x
        </span>
      );
    }
    case "everythingRate": {
      const best = Math.max(...allCards.map((c) => c.everythingRate));
      return (
        <span className={card.everythingRate === best ? "text-success font-bold" : "text-foreground font-semibold"}>
          {card.everythingRate}x
        </span>
      );
    }
    case "bestCPP": {
      const best = Math.max(...allCards.map((c) => c.bestCPP));
      return (
        <span className={card.bestCPP === best ? "text-success font-bold" : "text-foreground font-semibold"}>
          {card.bestCPP}¢
        </span>
      );
    }
    case "loungeAccess":
      return card.loungeAccess
        ? <Check size={14} className="text-success mx-auto" />
        : <X size={14} className="text-muted-foreground mx-auto" />;
    case "travelCredit":
      return card.travelCredit > 0
        ? <span className="text-success font-semibold">${card.travelCredit}</span>
        : <span className="text-muted-foreground">—</span>;
    case "noFTF":
      return card.noFTF
        ? <Check size={14} className="text-success mx-auto" />
        : <X size={14} className="text-destructive mx-auto" />;
    case "sweetSpot":
      return (
        <span className="text-[10px] text-muted-foreground leading-snug">{card.sweetSpot}</span>
      );
    case "transferPartners":
      return (
        <div className="flex flex-col gap-0.5">
          {card.transferPartners.slice(0, 3).map((p) => (
            <span key={p} className="text-[10px] text-muted-foreground">{p}</span>
          ))}
          {card.transferPartners.length > 3 && (
            <span className="text-[10px] text-primary">+{card.transferPartners.length - 3} more</span>
          )}
        </div>
      );
  }
}

// ─── Best-for summary ─────────────────────────────────────────────────────────

function BestFor({ selected }: { selected: CompareCard[] }) {
  if (selected.length < 2) return null;

  const bestDining = selected.reduce((a, b) => (a.diningRate >= b.diningRate ? a : b));
  const bestTravel = selected.reduce((a, b) => (a.travelRate >= b.travelRate ? a : b));
  const bestEverything = selected.reduce((a, b) => (a.everythingRate >= b.everythingRate ? a : b));
  const bestCPP = selected.reduce((a, b) => (a.bestCPP >= b.bestCPP ? a : b));
  const lowestFee = selected.reduce((a, b) => (a.annualFee <= b.annualFee ? a : b));

  const items = [
    { label: "Dining", winner: bestDining, detail: `${bestDining.diningRate}x` },
    { label: "Travel", winner: bestTravel, detail: `${bestTravel.travelRate}x` },
    { label: "Everything", winner: bestEverything, detail: `${bestEverything.everythingRate}x` },
    { label: "Best CPP", winner: bestCPP, detail: `${bestCPP.bestCPP}¢` },
    { label: "Lowest Fee", winner: lowestFee, detail: `$${lowestFee.annualFee}` },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <CheckCircle2 size={12} className="text-primary" />
        Best For
      </p>
      <div className="flex flex-col gap-2">
        {items.map(({ label, winner, detail }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: winner.color, color: winner.textColor }}
              >
                {winner.shortName}
              </span>
              <span className="text-xs font-semibold text-foreground">{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["csp", "venturex"]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }

  const selectedCards = COMPARE_CARDS.filter((c) => selected.has(c.id));

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader
        title="Card Comparison"
        backHref="/strategy"
        subtitle="Side-by-side — select up to 3 cards"
      />

      <div className="flex flex-col gap-4 px-4">
        {/* Card selector */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Select cards (max 3)
          </p>
          <div className="flex flex-wrap gap-2">
            {COMPARE_CARDS.map((c) => {
              const isSelected = selected.has(c.id);
              const disabled = !isSelected && selected.size >= 3;
              return (
                <button
                  key={c.id}
                  onClick={() => !disabled && toggle(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : disabled
                      ? "border-border bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c.shortName}
                  {!c.owned && <span className="ml-1 opacity-60">·</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Cards without dot = you own them</p>
        </div>

        {selectedCards.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Select at least 1 card above</p>
        ) : (
          <>
            {/* Comparison table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Column headers */}
              <div
                className="grid border-b border-border"
                style={{ gridTemplateColumns: `140px repeat(${selectedCards.length}, 1fr)` }}
              >
                <div className="p-3" />
                {selectedCards.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 text-center border-l border-border"
                    style={{ backgroundColor: c.color }}
                  >
                    <p className="text-[11px] font-bold leading-tight" style={{ color: c.textColor }}>
                      {c.shortName}
                    </p>
                    <p className="text-[9px] opacity-70" style={{ color: c.textColor }}>
                      {c.issuer}
                    </p>
                    {!c.owned && (
                      <span className="text-[8px] bg-white/20 rounded px-1 py-0.5 font-medium" style={{ color: c.textColor }}>
                        Not owned
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {ROWS.map((row, i) => (
                <div
                  key={row.key}
                  className={`grid border-b border-border/50 last:border-b-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  style={{ gridTemplateColumns: `140px repeat(${selectedCards.length}, 1fr)` }}
                >
                  <div className="px-3 py-2.5 flex items-start">
                    <span className="text-[11px] font-semibold text-muted-foreground leading-snug">{row.label}</span>
                  </div>
                  {selectedCards.map((c) => (
                    <div key={c.id} className="px-2 py-2.5 border-l border-border/40 text-center flex items-start justify-center">
                      {renderCell(c, row.key, selectedCards)}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Best-for summary */}
            <BestFor selected={selectedCards} />
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
