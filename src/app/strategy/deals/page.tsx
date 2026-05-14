"use client";

import { useState, useMemo } from "react";
import {
  Zap, TrendingUp, CreditCard, Gift, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, Star, Flame,
  ArrowRight,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";
import { DEALS, scoreDeals, type Deal, type DealType } from "@/lib/strategy-data";
import { POINTS_FULL } from "@/lib/points-balances";

// ── Branding ──────────────────────────────────────────────────────────────────

const PROGRAM_BRAND: Record<string, { color: string; bg: string; short: string }> = {
  "Chase UR":         { color: "#FFFFFF", bg: "#117ACA", short: "C" },
  "Capital One":      { color: "#FFFFFF", bg: "#C41230", short: "C1" },
  "Marriott Bonvoy":  { color: "#FFFFFF", bg: "#8B0000", short: "MB" },
  "Amex MR":          { color: "#000000", bg: "#C9A84C", short: "AX" },
  "Citi TY":          { color: "#FFFFFF", bg: "#003B70", short: "CT" },
};

function getBrand(program: string) {
  return PROGRAM_BRAND[program] ?? { color: "#FFFFFF", bg: "#6B7280", short: program[0] };
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreStyle(s: number): { ring: string; text: string; badge: string } {
  if (s >= 8.5) return { ring: "border-emerald-500", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" };
  if (s >= 7.0) return { ring: "border-primary",    text: "text-primary",     badge: "bg-primary/10 text-primary border border-primary/30" };
  if (s >= 5.0) return { ring: "border-amber-500",  text: "text-amber-600",   badge: "bg-amber-500/10 text-amber-600 border border-amber-500/30" };
  return               { ring: "border-border",      text: "text-muted-foreground", badge: "bg-muted text-muted-foreground border border-border" };
}

function typeLabel(t: DealType) {
  if (t === "transfer_bonus") return "Transfer Bonus";
  if (t === "sweet_spot")     return "Sweet Spot";
  if (t === "card_sub")       return "Card Offer";
  if (t === "limited_offer")  return "Limited Offer";
  return "Deal";
}

function typeIcon(t: DealType) {
  const cls = "shrink-0";
  if (t === "transfer_bonus" || t === "sweet_spot") return <TrendingUp size={11} className={cls} />;
  if (t === "card_sub")   return <CreditCard size={11} className={cls} />;
  if (t === "limited_offer") return <Gift size={11} className={cls} />;
  return <Star size={11} className={cls} />;
}

// ── Program Logo ──────────────────────────────────────────────────────────────

function ProgramBadge({ program, size = "md" }: { program: string; size?: "sm" | "md" | "lg" }) {
  const { color, bg, short } = getBrand(program);
  const cls = size === "sm"
    ? "w-7 h-7 rounded-lg text-[9px]"
    : size === "lg"
    ? "w-11 h-11 rounded-2xl text-sm"
    : "w-8 h-8 rounded-xl text-[10px]";
  return (
    <div
      className={`${cls} flex items-center justify-center font-extrabold shrink-0 shadow-sm`}
      style={{ backgroundColor: bg, color }}
    >
      {short}
    </div>
  );
}

// ── Urgency pill ──────────────────────────────────────────────────────────────

function UrgencyPill({ urgency }: { urgency: Deal["urgency"] }) {
  if (urgency === "hot") return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
      <Flame size={8} />HOT
    </span>
  );
  if (urgency === "medium") return (
    <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">ACTIVE</span>
  );
  return null;
}

// ── Deal card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, featured = false }: { deal: Deal; featured?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const style = scoreStyle(deal.score);
  const avoid = deal.score < 3;
  const { bg: programBg } = getBrand(deal.program);

  return (
    <div className={`rounded-2xl border bg-card overflow-hidden transition-shadow ${
      featured ? "border-primary/30 shadow-md shadow-primary/10" : "border-border"
    }`}>
      {/* Colored top strip */}
      <div className="h-0.5 w-full" style={{ backgroundColor: programBg }} />

      {/* Main row — tappable to expand */}
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Program logo */}
        <ProgramBadge program={deal.program} size="md" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <UrgencyPill urgency={deal.urgency} />
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              {typeIcon(deal.type)}{typeLabel(deal.type)}
            </span>
          </div>
          <p className={`text-sm font-bold leading-snug ${avoid ? "text-muted-foreground" : "text-foreground"}`}>
            {deal.headline}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{deal.subheadline}</p>
          {deal.expiresNote && (
            <p className={`text-[10px] mt-1.5 font-medium ${deal.urgency === "hot" ? "text-red-500" : "text-muted-foreground"}`}>
              ⏱ {deal.expiresNote}
            </p>
          )}
        </div>

        {/* Score badge */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className={`w-10 h-10 rounded-xl border-2 ${style.ring} flex items-center justify-center`}>
            <span className={`text-sm font-bold ${style.text}`}>{deal.score.toFixed(1)}</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-medium">/ 10</span>
        </div>

        {expanded
          ? <ChevronUp size={14} className="text-muted-foreground shrink-0 mt-2" />
          : <ChevronDown size={14} className="text-muted-foreground shrink-0 mt-2" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 flex flex-col gap-3 bg-muted/20">
          {/* Why this score */}
          <div className="rounded-xl bg-background border border-border px-3 py-2.5">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Why this score</p>
            <p className="text-xs text-foreground leading-relaxed">{deal.scoreReason}</p>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">{deal.description}</p>

          {/* Your portfolio note */}
          {deal.userNote && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 flex gap-2 items-start">
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Star size={9} className="text-primary" />
              </div>
              <p className="text-[11px] text-primary font-medium leading-snug">{deal.userNote}</p>
            </div>
          )}

          {/* Tags */}
          {deal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deal.tags.map((t) => (
                <span key={t} className="text-[9px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          {deal.actionUrl && !avoid && (
            <a
              href={deal.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: programBg }}
            >
              {deal.action}
              <ExternalLink size={13} />
            </a>
          )}
          {avoid && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2.5">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive font-semibold">{deal.action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────

type FilterOption = "all" | "hot" | "transfer" | "card_sub";

const FILTERS: Array<{ id: FilterOption; label: string; icon: React.ReactNode }> = [
  { id: "all",      label: "All",          icon: <Zap size={11} /> },
  { id: "hot",      label: "Hot",          icon: <Flame size={11} /> },
  { id: "transfer", label: "Transfers",    icon: <TrendingUp size={11} /> },
  { id: "card_sub", label: "Card Offers",  icon: <CreditCard size={11} /> },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [filter, setFilter] = useState<FilterOption>("all");

  const userBalances = useMemo(() => {
    const b = { chase_ur: 0, capital_one: 0, marriott: 0 };
    for (const p of POINTS_FULL) {
      if (p.program === "chase_ur")         b.chase_ur     = p.balance;
      if (p.program === "capital_one")      b.capital_one  = p.balance;
      if (p.program === "marriott_bonvoy")  b.marriott     = p.balance;
    }
    return b;
  }, []);

  const scoredDeals = useMemo(
    () => scoreDeals(DEALS, userBalances).sort((a, b) => b.score - a.score),
    [userBalances]
  );

  const filtered = useMemo(() => {
    if (filter === "hot")      return scoredDeals.filter((d) => d.urgency === "hot");
    if (filter === "transfer") return scoredDeals.filter((d) => d.type === "transfer_bonus" || d.type === "sweet_spot");
    if (filter === "card_sub") return scoredDeals.filter((d) => d.type === "card_sub");
    return scoredDeals;
  }, [scoredDeals, filter]);

  const topDeal = scoredDeals[0];
  const hotCount = scoredDeals.filter((d) => d.urgency === "hot").length;
  const highScoreCount = scoredDeals.filter((d) => d.score >= 8).length;

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader title="Deals & Offers" backHref="/strategy" subtitle="Scored for your portfolio" />

      <div className="flex flex-col gap-4 px-4">

        {/* Hero — top pick */}
        {topDeal && (() => {
          const brand = getBrand(topDeal.program);
          return (
            <div
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: `linear-gradient(135deg, ${brand.bg}ee 0%, ${brand.bg}99 100%)` }}
            >
              <ProgramBadge program={topDeal.program} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-0.5">Top Pick Right Now</p>
                <p className="text-sm font-bold text-white leading-snug">{topDeal.headline}</p>
                <p className="text-[11px] text-white/80 mt-0.5">{topDeal.subheadline}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-extrabold text-white">{topDeal.score.toFixed(1)}</p>
                <p className="text-[10px] text-white/60 font-semibold">/10</p>
              </div>
            </div>
          );
        })()}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-foreground">{scoredDeals.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total Deals</p>
          </div>
          <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-red-500">{hotCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Hot Now</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{highScoreCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Score ≥ 8.0</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border transition-all ${
                filter === f.id
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
              }`}
            >
              {f.icon}{f.label}
              {f.id === "hot" && hotCount > 0 && (
                <span className={`text-[9px] font-bold rounded-full px-1 ${filter === f.id ? "bg-white/20 text-white" : "bg-red-500/10 text-red-500"}`}>
                  {hotCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Score guide */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Score Guide</p>
          <div className="flex gap-4 flex-wrap">
            {[
              { range: "8.5–10", label: "Act now", dot: "bg-emerald-500" },
              { range: "7–8.4",  label: "Strong",  dot: "bg-primary" },
              { range: "5–6.9",  label: "Situational", dot: "bg-amber-500" },
              { range: "< 5",    label: "Skip", dot: "bg-slate-400" },
            ].map((g) => (
              <div key={g.range} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${g.dot}`} />
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{g.range}</span> · {g.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No deals match this filter</p>
            <button
              onClick={() => setFilter("all")}
              className="mt-3 text-xs text-primary font-semibold flex items-center gap-1 mx-auto"
            >
              Show all deals <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Deal list */}
        <div className="flex flex-col gap-3">
          {filtered.map((deal, i) => (
            <DealCard key={deal.id} deal={deal} featured={i === 0 && filter === "all"} />
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed pb-2">
          Scores personalized to your balances and travel goals. Updated May 2026. Verify all offers before acting.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
