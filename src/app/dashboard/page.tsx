"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight, ChevronDown, ChevronUp, Building2, RefreshCw,
  Coins, UtensilsCrossed, Car, Home, Plane, ShoppingBag, Heart,
  Gamepad2, Coffee, Sparkles, Gift, Bot, Wrench, Package,
  TrendingUp, DollarSign, ArrowRight, ArrowRightLeft, AlertTriangle,
  Zap, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AccountWithHoldings } from "@/app/api/accounts/holdings-with-prices/route";
import { BottomNav } from "@/components/bottom-nav";
import { useCardNameMap, detectCardNameFromPlaid } from "@/lib/use-card-name-map";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CardBalance {
  plaid_account_id: string;
  item_id?: string;
  name: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  utilization_pct: number | null;
  account_type: string | null;
  account_subtype: string | null;
  as_of?: string;
}

interface RawTx {
  id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  plaid_account_id: string | null;
}

interface PointsBalance { program: string; balance: number; cpp?: number; }
type AcctGroup = "cash" | "credit" | "investment" | "retirement" | "hsa";

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}
function currentYYYYMM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function relDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function cleanMerchant(raw: string | null) {
  if (!raw) return "Unknown";
  return raw.replace(/\*+/g, " ").replace(/\s{2,}/g, " ").replace(/\d{6,}/g, "").trim()
    .split(" ").slice(0, 4).join(" ");
}

// Normalize Plaid sandbox names ("TOTAL CHECKING", "CHASE SAVINGS", "CREDIT CARD")
// into clean Title Case ("Total Checking", "Chase Savings", "Credit Card").
// Leaves mixed-case names untouched so real product names ("Sapphire Preferred")
// don't get re-cased.
function titleCaseIfShouty(raw: string | null): string {
  if (!raw) return "Account";
  const trimmed = raw.trim();
  // Only re-case if the string is entirely uppercase (sandbox style)
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return trimmed;
}

// Institution-based overrides for cards that Plaid returns with generic names.
// Keyed by lowercased institution string from plaid_items.
const INSTITUTION_CARD_HINTS: Record<string, string> = {
  "capital one": "Venture X",
};

// Build a display name for any account row:
//   1. Map by last4 (user-configured in Settings → My Cards)
//   2. Auto-detect card product names from Plaid string
//   3. Institution-based fallback for known generic names (e.g. Cap One "credit Account XXXX")
//   4. Normalize ALL CAPS strings → Title Case
//   Mask suffix appended in all branches.
function displayAccountName(
  rawName: string | null,
  mask: string | null,
  cardNameMap: Map<string, string>,
  institution?: string,
): string {
  const suffix = mask ? ` ····${mask}` : "";
  if (mask && cardNameMap.has(mask)) return `${cardNameMap.get(mask)}${suffix}`;
  const detected = detectCardNameFromPlaid(rawName);
  if (detected) return `${detected}${suffix}`;
  // Generic names like "credit Account XXXX" from Capital One → use institution hint
  if (institution) {
    const hint = INSTITUTION_CARD_HINTS[institution.toLowerCase()];
    if (hint) return `${hint}${suffix}`;
  }
  return `${titleCaseIfShouty(rawName)}${suffix}`;
}

// ─── Account Classification ────────────────────────────────────────────────

function classifyAccount(b: CardBalance): AcctGroup {
  // Trust Plaid's explicit type first
  if (b.account_type === "credit") return "credit";
  if (b.account_subtype === "hsa")  return "hsa";
  if (b.account_type === "investment" || b.account_type === "brokerage") {
    const sub = (b.account_subtype ?? "").toLowerCase();
    if (sub.includes("401") || sub.includes("ira") || sub.includes("roth") ||
        sub.includes("pension") || sub.includes("retirement")) return "retirement";
    return "investment";
  }
  if (b.account_type === "depository") return "cash";

  // Fallback: credit_limit present → definitely a credit card
  if (b.credit_limit !== null && b.credit_limit > 0) return "credit";

  // Name-based fallback (handles accounts synced before migration 0005)
  const n = (b.name ?? "").toLowerCase();

  // Credit cards — common issuer product names
  if (n.includes("credit card") || n.includes("sapphire") || n.includes("freedom") ||
      n.includes("venture x") || n.includes("venture") || n.includes("boundless") ||
      n.includes("bonvoy") || n.includes("reserve") || n.includes("preferred") ||
      n.includes("unlimited") || n.includes("cashback") || n.includes("cash back") ||
      n.includes("mastercard") || n.includes("visa credit") || n.includes("amex") ||
      n.includes("discover it")) return "credit";

  // Retirement
  if (n.includes("401") || n.includes("roth") || n.match(/\bira\b/) ||
      n.includes("retirement") || n.includes("pension") || n.includes("403b")) return "retirement";

  // HSA
  if (n.includes("hsa") || n.includes("health savings")) return "hsa";

  // Investment / brokerage
  if (n.includes("brokerage") || n.includes("invest") || n.includes("portfolio") ||
      n.includes("etrade") || n.includes("schwab") || n.includes("fidelity") ||
      n.includes("merrill") || n.includes("vanguard") || n.includes("ubs") ||
      n.includes("robinhood") || n.includes("wealthfront") || n.includes("betterment"))
    return "investment";

  // Default to cash (checking, savings, Marcus, etc.)
  return "cash";
}

// ─── Branding ──────────────────────────────────────────────────────────────

function getBrand(name: string | null) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("chase"))         return { bg: "#117ACA", fg: "#fff", initials: "C"  };
  if (n.includes("capital one"))   return { bg: "#C41230", fg: "#fff", initials: "C1" };
  if (n.includes("fidelity"))      return { bg: "#52B043", fg: "#fff", initials: "Fi" };
  if (n.includes("merrill") || n.includes("bofa") || n.includes("bank of america"))
                                   return { bg: "#D70015", fg: "#fff", initials: "ML" };
  if (n.includes("marcus") || n.includes("goldman"))
                                   return { bg: "#1A1A1A", fg: "#fff", initials: "GS" };
  if (n.includes("schwab"))        return { bg: "#0577B6", fg: "#fff", initials: "CS" };
  if (n.includes("vanguard"))      return { bg: "#811A24", fg: "#fff", initials: "VG" };
  if (n.includes("ubs"))           return { bg: "#E40046", fg: "#fff", initials: "UB" };
  if (n.includes("inspira"))       return { bg: "#1E5A96", fg: "#fff", initials: "In" };
  if (n.includes("wells"))         return { bg: "#D71E28", fg: "#fff", initials: "WF" };
  if (n.includes("ally"))          return { bg: "#6B21A8", fg: "#fff", initials: "Al" };
  if (n.includes("discover"))      return { bg: "#F76F20", fg: "#fff", initials: "Di" };
  if (n.includes("amex") || n.includes("american express"))
                                   return { bg: "#007BC1", fg: "#fff", initials: "AX" };
  return { bg: "#6B7280", fg: "#fff", initials: (name?.[0] ?? "?").toUpperCase() };
}

function Avatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" }) {
  const { bg, fg, initials } = getBrand(name);
  const cls = size === "sm" ? "w-7 h-7 rounded-lg text-[9px]" : "w-8 h-8 rounded-xl text-[10px]";
  return (
    <div className={`${cls} flex items-center justify-center font-extrabold shrink-0`}
      style={{ background: bg, color: fg }}>
      {initials}
    </div>
  );
}

// ─── Category icons (no emojis) ────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

const CAT_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  Food:           { Icon: UtensilsCrossed, color: "#f97316" },
  Drinks:         { Icon: Coffee,          color: "#a78bfa" },
  Housing:        { Icon: Home,            color: "#6366f1" },
  Transportation: { Icon: Car,             color: "#3b82f6" },
  Entertainment:  { Icon: Gamepad2,        color: "#ec4899" },
  Travel:         { Icon: Plane,           color: "#0ea5e9" },
  "Personal Care":{ Icon: Sparkles,        color: "#14b8a6" },
  Health:         { Icon: Heart,           color: "#22c55e" },
  Gifts:          { Icon: Gift,            color: "#f59e0b" },
  "AI Spend":     { Icon: Bot,             color: "#8b5cf6" },
  Shopping:       { Icon: ShoppingBag,     color: "#f43f5e" },
  Services:       { Icon: Wrench,          color: "#64748b" },
  Income:         { Icon: DollarSign,      color: "#22c55e" },
  Other:          { Icon: Package,         color: "#94a3b8" },
  FOOD_AND_DRINK: { Icon: UtensilsCrossed, color: "#f97316" },
  TRANSPORTATION: { Icon: Car,             color: "#3b82f6" },
  ENTERTAINMENT:  { Icon: Gamepad2,        color: "#ec4899" },
  TRAVEL:         { Icon: Plane,           color: "#0ea5e9" },
  RENT_AND_UTILITIES: { Icon: Home,        color: "#6366f1" },
  MEDICAL:        { Icon: Heart,           color: "#22c55e" },
  GENERAL_MERCHANDISE: { Icon: ShoppingBag, color: "#f43f5e" },
  SHOPPING:       { Icon: ShoppingBag,     color: "#f43f5e" },
  GENERAL_SERVICES: { Icon: Wrench,        color: "#64748b" },
};

function CategoryIcon({ category }: { category: string | null }) {
  const def = CAT_ICON[category ?? ""] ?? CAT_ICON["Other"];
  const { Icon, color } = def;
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: color + "18" }}>
      <Icon size={15} style={{ color }} />
    </div>
  );
}

const PROG_BRAND: Record<string, { bg: string; initials: string }> = {
  "Chase UR":        { bg: "#117ACA", initials: "C"  },
  "Capital One":     { bg: "#C41230", initials: "C1" },
  "Marriott Bonvoy": { bg: "#8B0000", initials: "MB" },
  "Amex MR":         { bg: "#C9A84C", initials: "AX" },
};

// ─── Account row ───────────────────────────────────────────────────────────

function AccountRow({ acct, cardNameMap, institutionMap }: { acct: CardBalance; cardNameMap: Map<string, string>; institutionMap: Map<string, string> }) {
  const isCard = classifyAccount(acct) === "credit";
  const bal = acct.current_balance ?? 0;
  const util = acct.utilization_pct;
  const utilColor = util != null
    ? (util > 30 ? "text-destructive" : util > 9 ? "text-amber-500" : "text-emerald-500") : "";
  const institution = acct.item_id ? institutionMap.get(acct.item_id) : undefined;
  const display = displayAccountName(acct.name, acct.mask, cardNameMap, institution);
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar name={acct.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{display}</p>
        {isCard && util != null && (
          <p className={`text-[10px] font-medium ${utilColor}`}>{util}% utilized</p>
        )}
        {!isCard && acct.available_balance != null && acct.available_balance !== bal && (
          <p className="text-[10px] text-muted-foreground">${fmt(acct.available_balance)} available</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isCard ? "text-destructive" : "text-foreground"}`}>
          {isCard ? "−" : ""}${fmt(bal)}
        </p>
        {isCard && acct.credit_limit && (
          <p className="text-[10px] text-muted-foreground">of ${fmt(acct.credit_limit)} limit</p>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible account group ─────────────────────────────────────────────

function AccountSection({
  title, accounts, total, isLiability, startOpen = true, cardNameMap, institutionMap,
}: {
  title: string; accounts: CardBalance[]; total: number; isLiability?: boolean; startOpen?: boolean;
  cardNameMap: Map<string, string>; institutionMap: Map<string, string>;
}) {
  const [open, setOpen] = useState(startOpen);
  if (!accounts.length) return null;
  return (
    <div className="border-b border-border/50 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{accounts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isLiability ? "text-destructive" : "text-foreground"}`}>
            {isLiability ? "−" : ""}${fmt(total)}
          </span>
          {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="pb-1 divide-y divide-border/40">
          {accounts.map(a => <AccountRow key={a.plaid_account_id} acct={a} cardNameMap={cardNameMap} institutionMap={institutionMap} />)}
        </div>
      )}
    </div>
  );
}

// ─── Investment section ────────────────────────────────────────────────────

function InvestmentSection({
  plaidAccounts, manualAccounts, total, cardNameMap, institutionMap,
}: {
  plaidAccounts: CardBalance[];
  manualAccounts: AccountWithHoldings[];
  total: number;
  cardNameMap: Map<string, string>;
  institutionMap: Map<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const count = plaidAccounts.length + manualAccounts.length;
  if (count === 0) return null;

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">Investments</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">${fmt(total)}</span>
          {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="pb-1 divide-y divide-border/40">
          {plaidAccounts.map(a => <AccountRow key={a.plaid_account_id} acct={a} cardNameMap={cardNameMap} institutionMap={institutionMap} />)}
          {manualAccounts.map(a => {
            const val = a.liveValue ?? a.balance;
            const isExp = expanded.has(a.id);
            return (
              <div key={a.id}>
                <div className="flex items-center gap-3 py-3">
                  <Avatar name={a.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                      {a.liveValue !== null && <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-1 py-0.5 rounded-full">Live</span>}
                    </div>
                    {a.institution && <p className="text-[10px] text-muted-foreground">{a.institution}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <p className="text-sm font-semibold text-foreground">${fmt(val)}</p>
                    {a.holdings.length > 0 && (
                      <button onClick={() => toggle(a.id)}>
                        {isExp ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                      </button>
                    )}
                  </div>
                </div>
                {isExp && a.holdings.length > 0 && (
                  <div className="bg-muted/30 rounded-xl px-3 py-2 mb-2 flex flex-col gap-2">
                    {a.holdings.map(h => (
                      <div key={h.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold">{h.ticker ?? "—"}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{h.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{h.shares} sh{h.livePrice != null && ` · $${fmt(h.livePrice, 2)}`}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-semibold">{h.liveValue != null ? `$${fmt(h.liveValue)}` : "—"}</p>
                          {h.gainLoss != null && (
                            <p className={`text-[10px] ${h.gainLoss >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                              {h.gainLoss >= 0 ? "+" : ""}${fmt(Math.abs(h.gainLoss))}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Net Worth Graph (historical snapshots) ────────────────────────────────

interface NWSnapshot { recorded_date: string; net_worth: number; }

function NetWorthGraph({ snapshots }: { snapshots: NWSnapshot[] }) {
  if (snapshots.length === 0) return null;

  // With only 1 point, show a simple "tracking started" state
  if (snapshots.length === 1) {
    const d = new Date(snapshots[0].recorded_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return (
      <div className="mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">Net Worth Trend</span>
          <span className="text-[10px] text-muted-foreground">Tracking since {d}</span>
        </div>
        <div className="mt-2 h-px bg-primary/30 w-full rounded-full" />
        <p className="text-[9px] text-muted-foreground mt-1.5">Graph builds as daily snapshots accumulate</p>
      </div>
    );
  }
  const values = snapshots.map(s => s.net_worth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaColor = delta >= 0 ? "#22c55e" : "#ef4444";

  // Build SVG polyline points
  const W = 300; const H = 48;
  const points = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * W;
    const y = H - ((s.net_worth - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  function fmtK(n: number) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  const startLabel = new Date(snapshots[0].recorded_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = new Date(snapshots[snapshots.length - 1].recorded_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground font-medium">Net Worth Trend</span>
        <span className={`text-[10px] font-bold`} style={{ color: deltaColor }}>
          {delta >= 0 ? "+" : ""}{fmtK(delta)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "48px" }} preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={deltaColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">{startLabel}</span>
        <span className="text-[9px] text-muted-foreground">{endLabel}</span>
      </div>
    </div>
  );
}

// ─── 6-Month Spending Graph ────────────────────────────────────────────────

function SpendingGraph({ data, onSelectMonth }: {
  data: Array<{ month: string; amount: number }>;
  onSelectMonth: (m: string) => void;
}) {
  // Only show months that have data
  const withData = data.filter(d => d.amount > 0);
  if (withData.length === 0) return null;
  const max = Math.max(...withData.map(d => d.amount), 1);
  const current = currentYYYYMM();

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Spending History</p>
        <Link href="/expenses" className="text-[11px] text-primary font-semibold flex items-center gap-1">
          Details <ChevronRight size={11} />
        </Link>
      </div>
      <div className="flex items-end gap-2" style={{ height: "80px" }}>
        {withData.map(({ month, amount }) => {
          const pct = (amount / max) * 100;
          const isCurrent = month === current;
          const [yr, mo] = month.split("-");
          const label = new Date(Number(yr), Number(mo) - 1, 1)
            .toLocaleDateString("en-US", { month: "short" });
          return (
            <button key={month} onClick={() => onSelectMonth(month)}
              className="flex-1 flex flex-col items-center gap-1 group">
              <span className={`text-[9px] font-bold leading-none ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                {amount >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : `$${Math.round(amount)}`}
              </span>
              <div className="w-full flex items-end flex-1">
                <div className="w-full rounded-t-md transition-all group-active:opacity-70"
                  style={{
                    height: `${Math.max(pct, 6)}%`,
                    backgroundColor: isCurrent ? "#117ACA" : "#117ACA30",
                  }}
                />
              </div>
              <span className={`text-[9px] leading-none ${isCurrent ? "font-bold text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month picker — oldest on LEFT, newest on RIGHT ────────────────────────

function MonthPicker({ selected, onChange }: { selected: string; onChange: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const months: Array<{ yyyyMM: string; label: string }> = [];
  const now = new Date();
  // Build oldest→newest (5 months ago → current)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      yyyyMM: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }
  // Auto-scroll to end (current month) on mount
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);

  return (
    <div ref={ref} className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-0.5">
      {months.map(m => (
        <button key={m.yyyyMM} onClick={() => onChange(m.yyyyMM)}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            m.yyyyMM === selected ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Transaction row (dashboard preview) ──────────────────────────────────

function TxRow({ tx, acctMap }: { tx: RawTx; acctMap: Record<string, string | null> }) {
  const acctName = acctMap[tx.plaid_account_id ?? ""] ?? null;
  const brand = getBrand(acctName);
  return (
    <div className="py-3 flex items-center gap-3 first:pt-0">
      <CategoryIcon category={tx.category} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{cleanMerchant(tx.merchant_raw)}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {acctName && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: brand.bg + "22", color: brand.bg }}>
              {brand.initials}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{relDate(tx.posted_at)}</span>
        </div>
      </div>
      <p className="text-sm font-bold shrink-0 text-foreground">
        −${fmt(Math.abs(tx.amount), 2)}
      </p>
    </div>
  );
}

// ─── Quick-stat card ───────────────────────────────────────────────────────

function QuickCard({
  label, value, sub, href, color = "text-foreground",
}: {
  label: string; value: string; sub?: string; href: string; color?: string;
}) {
  return (
    <Link href={href}
      className="flex-1 rounded-2xl border border-border bg-card px-4 py-4 flex flex-col gap-1 active:opacity-70 transition-opacity">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      <div className="flex items-center gap-1 mt-1 text-[10px] text-primary font-semibold">
        View <ArrowRight size={10} />
      </div>
    </Link>
  );
}

// ─── Daily Brief ───────────────────────────────────────────────────────────
// Horizontally scrollable intelligence cards surfacing what matters today.

interface BriefCard {
  id: string;
  type: "opportunity" | "warning" | "info" | "pace";
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
  accent: string; // tailwind bg class or inline style
}

const BRIEF_DISMISS_KEY = "brief_dismissed_v1";

function getDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BRIEF_DISMISS_KEY) ?? "{}"); } catch { return {}; }
}
function dismissCard(id: string) {
  const d = getDismissed();
  d[id] = Date.now();
  localStorage.setItem(BRIEF_DISMISS_KEY, JSON.stringify(d));
}
function isCardDismissed(id: string, ttlDays = 30): boolean {
  const d = getDismissed();
  if (!d[id]) return false;
  return Date.now() - d[id] < ttlDays * 86_400_000;
}

function DailyBrief({
  points,
  monthExpenses,
  spendMonth,
}: {
  points: Array<{ program: string; balance: number; cpp?: number }>;
  monthExpenses: number | null;
  spendMonth: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function dismiss(id: string) {
    dismissCard(id);
    setDismissed(prev => new Set([...prev, id]));
  }

  // Build contextual brief cards from live + known data
  const cards: BriefCard[] = [];

  // 1. Points deployment opportunity — Cap1 miles for Europe
  const cap1 = points.find(p => p.program === "Capital One");
  if (cap1 && cap1.balance > 50_000) {
    cards.push({
      id: "cap1-europe",
      type: "opportunity",
      icon: <Plane size={18} className="text-white" />,
      title: `${(cap1.balance / 1000).toFixed(0)}K Miles → Europe`,
      body: `Flying Blue (Air France/KLM) costs ~52K miles one-way in economy. You could book 1–2 flights now.`,
      cta: "Plan redemption",
      href: "/trip-planner",
      accent: "#C41230",
    });
  }

  // 2. Chase UR deployment
  const chaseUR = points.find(p => p.program === "Chase UR");
  if (chaseUR && chaseUR.balance > 8_000) {
    cards.push({
      id: "chase-hyatt",
      type: "opportunity",
      icon: <Coins size={18} className="text-white" />,
      title: `${(chaseUR.balance / 1000).toFixed(0)}K UR → Hyatt`,
      body: `Transfer to Hyatt at 1:1. A Chicago Hyatt room runs 12–17K pts/night — great value vs cash rate.`,
      cta: "See deals",
      href: "/strategy/deals",
      accent: "#117ACA",
    });
  }

  // 3. Marriott cert deployment (always relevant — user has 5 certs)
  cards.push({
    id: "marriott-certs",
    type: "warning",
    icon: <AlertTriangle size={18} className="text-white" />,
    title: "5 Free Night Certs",
    body: `Marriott free night certs expire annually. Book a Category 1–5 hotel before they lapse. Europe has great options.`,
    cta: "Find hotels",
    href: "/strategy/burn",
    accent: "#8B0000",
  });

  // 4. Marriott downgrade — evergreen action item
  cards.push({
    id: "boundless-downgrade",
    type: "warning",
    icon: <ArrowRightLeft size={18} className="text-white" />,
    title: "Save $95 — Downgrade Marriott",
    body: `Boundless costs $95/yr. Downgrading to Bonvoy Bold (free) preserves your account age and Marriott status.`,
    cta: "Start flow",
    href: "/strategy/downgrade/boundless",
    accent: "#d97706",
  });

  // 5. Spending pace (if data available)
  if (monthExpenses != null && monthExpenses > 0) {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const projected = (monthExpenses / dayOfMonth) * daysInMonth;
    const paceMsg = projected > monthExpenses
      ? `Projecting $${Math.round(projected).toLocaleString()} for the full month`
      : `You're ${dayOfMonth} days in`;
    cards.push({
      id: "pace",
      type: "pace",
      icon: <TrendingUp size={18} className="text-white" />,
      title: `$${Math.round(monthExpenses).toLocaleString()} spent so far`,
      body: paceMsg + `. Tap to see breakdown by category.`,
      cta: "View expenses",
      href: "/expenses",
      accent: "#6366f1",
    });
  }

  const visible = cards.filter(c => !dismissed.has(c.id) && !isCardDismissed(c.id));
  if (visible.length === 0) return null;


  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Zap size={12} className="text-primary" />
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Daily Brief</p>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {visible.map(card => (
          <div key={card.id} className="shrink-0 w-64 rounded-2xl overflow-hidden shadow-sm border border-border flex flex-col">
            {/* Colored top bar */}
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3"
              style={{ backgroundColor: card.accent }}>
              <div className="shrink-0">{card.icon}</div>
              <p className="text-sm font-bold text-white leading-tight flex-1">{card.title}</p>
              <button
                onClick={(e) => { e.preventDefault(); dismiss(card.id); }}
                className="shrink-0 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={13} className="text-white/70" />
              </button>
            </div>
            {/* Body */}
            <Link href={card.href} className="bg-card flex-1 px-4 py-3 flex flex-col justify-between gap-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{card.body}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: card.accent }}>
                {card.cta} <ArrowRight size={10} />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [balances, setBalances]             = useState<CardBalance[]>([]);
  const [manualAccounts, setManualAccounts] = useState<AccountWithHoldings[]>([]);
  const [recentTxs, setRecentTxs]           = useState<RawTx[]>([]);
  const [points, setPoints]                 = useState<PointsBalance[]>([]);
  const [lastSync, setLastSync]             = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [syncing, setSyncing]               = useState(false);

  // Spending summary (current month only — for quick stat)
  const [spendMonth, setSpendMonth] = useState(currentYYYYMM());
  const [monthExpenses, setMonthExpenses] = useState<number | null>(null);
  const [monthIncome, setMonthIncome] = useState<number | null>(null);

  // 6-month spending chart
  const [monthlySpend, setMonthlySpend] = useState<Array<{ month: string; amount: number }>>([]);

  // Net worth for the selected month from budget seed — null means show live Plaid value
  const [selectedMonthNW, setSelectedMonthNW] = useState<number | null>(null);

  // Net worth history for graph
  const [nwSnapshots, setNwSnapshots] = useState<NWSnapshot[]>([]);

  // Count of linked Plaid institutions — used to gate the "Connect …" prompt
  const [plaidItemsCount, setPlaidItemsCount] = useState(0);

  // item_id → institution name (e.g. "Capital One"), used for context-aware card naming
  const [institutionMap, setInstitutionMap] = useState<Map<string, string>>(new Map());

  // last4 → friendly card shortName, sourced from user_card_metadata
  const cardNameMap = useCardNameMap();

  const loadBalances = useCallback(async () => {
    const supabase = createClient();
    const [{ data: bals }, holdingsRes, { data: txs }, pointsRes, { data: plaidItems }] = await Promise.all([
      supabase
        .from("card_balances")
        .select("plaid_account_id,name,mask,current_balance,available_balance,credit_limit,utilization_pct,account_type,account_subtype,as_of,item_id")
        .order("name"),
      fetch("/api/accounts/holdings-with-prices").then(r => r.json()).catch(() => ({ accounts: [] })),
      supabase
        .from("transactions")
        .select("id,posted_at,amount,merchant_raw,category,plaid_account_id")
        .eq("pending", false)
        .gt("amount", 0)
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS","INCOME")')
        .order("posted_at", { ascending: false })
        .limit(8),
      fetch("/api/points-balances").then(r => r.json()).catch(() => ({ balances: [] })),
      supabase.from("plaid_items").select("item_id,institution"),
    ]);
    setPlaidItemsCount(plaidItems?.length ?? 0);
    if (plaidItems) {
      setInstitutionMap(new Map(plaidItems.map((i: { item_id: string; institution: string }) => [i.item_id, i.institution])));
    }
    if (bals) {
      setBalances(bals);
      const times = bals.map((b: CardBalance) => b.as_of).filter(Boolean) as string[];
      if (times.length) {
        const latest = times.sort().at(-1)!;
        setLastSync(new Date(latest).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        }));
      }
    }
    if (holdingsRes?.accounts) setManualAccounts(holdingsRes.accounts);
    if (txs) setRecentTxs(txs);
    if (pointsRes?.balances) setPoints(pointsRes.balances);
  }, []);

  useEffect(() => {
    loadBalances().finally(() => setLoading(false));
  }, [loadBalances]);

  // Manual sync — calls /api/plaid/sync then refreshes all data
  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await loadBalances();
    } catch { /* non-fatal */ }
    setSyncing(false);
  }, [syncing, loadBalances]);

  // Fetch 6-month spending for graph
  useEffect(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    Promise.all(
      months.map(m =>
        fetch(`/api/months/summary?month=${m}`).then(r => r.json()).catch(() => null)
      )
    ).then(results => {
      setMonthlySpend(months.map((m, i) => ({ month: m, amount: results[i]?.expenses ?? 0 })));
    });
  }, []);

  // Backfill historical data from budget seed, then load all snapshots for graph.
  // Backfill is idempotent (upsert) — safe to run every mount. Ensures the full
  // 20-month history is always populated even if the table was partially cleared.
  useEffect(() => {
    fetch("/api/net-worth/backfill", { method: "POST" })
      .then(() => fetch("/api/net-worth/snapshot").then(r => r.json()))
      .then(({ snapshots }) => { if (snapshots?.length) setNwSnapshots(snapshots); })
      .catch(() => {
        // Backfill failed — try loading whatever snapshots exist
        fetch("/api/net-worth/snapshot")
          .then(r => r.json())
          .then(({ snapshots }) => { if (snapshots?.length) setNwSnapshots(snapshots); })
          .catch(() => {});
      });
  }, []);

  // Fetch month summary for quick stats. Uses /api/months/summary which
  // returns Plaid data when available, falling back to the budget seed so
  // historical months always show real income/expenses + net worth.
  const fetchMonthSummary = useCallback((month: string) => {
    fetch(`/api/months/summary?month=${month}`)
      .then(r => r.json())
      .then(res => {
        if (res?.expenses != null) setMonthExpenses(res.expenses);
        if (res?.income != null)   setMonthIncome(res.income);
        // Use budget seed net worth for historical months; null = show live Plaid value
        setSelectedMonthNW(res?.netWorth ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchMonthSummary(spendMonth); }, [spendMonth, fetchMonthSummary]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const byGroup = {
    cash:       balances.filter(b => classifyAccount(b) === "cash"),
    credit:     balances.filter(b => classifyAccount(b) === "credit"),
    investment: balances.filter(b => classifyAccount(b) === "investment"),
    retirement: balances.filter(b => classifyAccount(b) === "retirement"),
    hsa:        balances.filter(b => classifyAccount(b) === "hsa"),
  };

  // Exclude Plaid-sourced accounts — they already appear in card_balances / byGroup.
  // Including them here causes double-counting (e.g. 401k counted in both
  // byGroup.retirement AND manualInvest because holdings-with-prices returns all accounts).
  const pureManual       = manualAccounts.filter(a => a.source !== "plaid");
  const manualRetirement = pureManual.filter(a => a.account_type === "retirement");
  const manualHsa        = pureManual.filter(a => a.account_type === "hsa");
  const manualInvest     = pureManual.filter(a => !["retirement","hsa"].includes(a.account_type));

  const totals = {
    cash:       byGroup.cash.reduce((s, b)       => s + (b.current_balance ?? 0), 0),
    credit:     byGroup.credit.reduce((s, b)     => s + (b.current_balance ?? 0), 0),
    investment: byGroup.investment.reduce((s, b) => s + (b.current_balance ?? 0), 0)
                + manualInvest.reduce((s, a) => s + (a.liveValue ?? a.balance), 0),
    retirement: byGroup.retirement.reduce((s, b) => s + (b.current_balance ?? 0), 0)
                + manualRetirement.reduce((s, a) => s + (a.liveValue ?? a.balance), 0),
    hsa:        byGroup.hsa.reduce((s, b)        => s + (b.current_balance ?? 0), 0)
                + manualHsa.reduce((s, a) => s + (a.liveValue ?? a.balance), 0),
  };

  const totalAssets = totals.cash + totals.investment + totals.retirement + totals.hsa;
  const netWorth    = totalAssets - totals.credit;
  const hasData     = balances.length > 0 || manualAccounts.length > 0;
  const totalPoints = points.reduce((s, p) => s + ((p.balance * (p.cpp ?? 1)) / 100), 0);
  const acctMap     = Object.fromEntries(balances.map(b => [b.plaid_account_id, b.name]));
  const allAccountCount = Object.values(byGroup).reduce((s, g) => s + g.length, 0) + pureManual.length;

  // Persist today's net worth snapshot — but ONLY if the locally-computed
  // value is at least within 10% of the most recent historical snapshot.
  // This sanity floor prevents partial Plaid syncs (e.g. only one of four
  // institutions returning balances) from clobbering an accurate prior value
  // with a low one, which previously produced a misleading "crash" at the
  // right edge of the net-worth graph.
  useEffect(() => {
    if (loading || !hasData) return;
    fetch("/api/net-worth/snapshot")
      .then(r => r.json())
      .then(({ snapshots }) => {
        const latest = snapshots?.[snapshots.length - 1]?.net_worth ?? 0;
        const sane = latest === 0 || netWorth >= latest * 0.9;
        if (!sane) {
          console.warn("[dashboard] skipping snapshot save — partial data suspected:", { netWorth, latest });
          if (snapshots?.length) setNwSnapshots(snapshots);
          return;
        }
        return fetch("/api/net-worth/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total_assets: totalAssets,
            total_liabilities: totals.credit,
            net_worth: netWorth,
            breakdown: { cash: totals.cash, investment: totals.investment, retirement: totals.retirement, hsa: totals.hsa, credit: totals.credit },
          }),
        })
          .then(() => fetch("/api/net-worth/snapshot").then(r => r.json()))
          .then(({ snapshots: s }) => { if (s?.length) setNwSnapshots(s); });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto animate-pulse">
        <div className="px-4 pt-5 pb-3">
          <div className="h-6 w-32 rounded-lg bg-muted mb-1.5" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="px-4 pt-2 flex flex-col gap-3">
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="h-48 rounded-2xl bg-muted" />
          <div className="h-32 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">

      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <button onClick={syncNow} disabled={syncing}
          className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 active:opacity-60 disabled:opacity-50">
          <RefreshCw size={9} className={syncing ? "animate-spin" : ""} />
          <span>{syncing ? "Syncing…" : lastSync ? `Synced ${lastSync}` : "Tap to sync"}</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4">

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!hasData && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 size={28} className="text-primary" />
            </div>
            <p className="font-bold text-lg text-foreground">Connect your accounts</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Link Chase, Marcus, Merrill, Fidelity and more to see your full financial picture.
            </p>
            <Link href="/settings/accounts"
              className="bg-primary text-white text-sm font-semibold px-6 py-3 rounded-xl">
              Connect Accounts
            </Link>
          </div>
        )}

        {/* ── Daily Brief ─────────────────────────────────────────── */}
        <DailyBrief
          points={points}
          monthExpenses={monthExpenses}
          spendMonth={spendMonth}
        />

        {hasData && (
          <>
            {/* ── Net Worth hero ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Net Worth</p>
                  {selectedMonthNW != null && (
                    <p className="text-[10px] text-muted-foreground">{monthLabel(spendMonth)}</p>
                  )}
                </div>
                <p className="text-4xl font-extrabold text-foreground tracking-tight mt-1">
                  {fmtK(selectedMonthNW ?? netWorth)}
                </p>
                <div className="flex gap-5 mt-3 flex-wrap">
                  {selectedMonthNW == null && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Assets</p>
                      <p className="text-sm font-bold text-emerald-500">{fmtK(totalAssets)}</p>
                    </div>
                  )}
                  {selectedMonthNW != null && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">From budget</p>
                      <p className="text-sm font-bold text-muted-foreground">{monthLabel(spendMonth)}</p>
                    </div>
                  )}
                  {totals.credit > 0 && selectedMonthNW == null && (
                    <>
                      <div className="w-px bg-border" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Credit Debt</p>
                        <p className="text-sm font-bold text-destructive">−{fmtK(totals.credit)}</p>
                      </div>
                    </>
                  )}
                  {totals.cash > 0 && selectedMonthNW == null && (
                    <>
                      <div className="w-px bg-border" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Cash</p>
                        <p className="text-sm font-bold text-foreground">{fmtK(totals.cash)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {nwSnapshots.length >= 1 && (
                <div className="px-5 pb-4">
                  <NetWorthGraph snapshots={nwSnapshots} />
                </div>
              )}
              {totalAssets > 0 && selectedMonthNW == null && (
                <div className="px-5 pb-4 border-t border-border/40 pt-3">
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                    {([
                      { val: totals.cash,       color: "#117ACA" },
                      { val: totals.hsa,         color: "#22c55e" },
                      { val: totals.retirement,  color: "#3b82f6" },
                      { val: totals.investment,  color: "#8b5cf6" },
                    ] as { val: number; color: string }[]).filter(s => s.val > 0).map((s, i) => (
                      <div key={i} className="h-full"
                        style={{ width: `${(s.val / totalAssets) * 100}%`, backgroundColor: s.color }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {[
                      { label: "Cash",       val: totals.cash,      color: "#117ACA" },
                      { label: "HSA",        val: totals.hsa,        color: "#22c55e" },
                      { label: "Retirement", val: totals.retirement, color: "#3b82f6" },
                      { label: "Brokerage",  val: totals.investment, color: "#8b5cf6" },
                    ].filter(s => s.val > 0).map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] text-muted-foreground">
                          {s.label} <span className="font-semibold text-foreground">{fmtK(s.val)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Spending & Income quick-links ─────────────────────── */}
            <div className="mb-1">
              <MonthPicker selected={spendMonth} onChange={setSpendMonth} />
            </div>
            <div className="flex gap-3">
              <QuickCard
                label="Expenses"
                value={monthExpenses != null ? `$${fmt(monthExpenses)}` : "—"}
                sub={monthLabel(spendMonth)}
                href="/expenses"
                color="text-foreground"
              />
              <QuickCard
                label="Income"
                value={monthIncome != null ? `$${fmt(monthIncome)}` : "—"}
                sub={monthLabel(spendMonth)}
                href="/income"
                color="text-emerald-500"
              />
            </div>

            {/* ── Spending Graph ────────────────────────────────────── */}
            <SpendingGraph data={monthlySpend} onSelectMonth={setSpendMonth} />

            {/* ── All Accounts ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">All Accounts</p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{allAccountCount}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/strategy/portfolio"
                    className="text-[11px] text-primary font-semibold">
                    Portfolio
                  </Link>
                  <Link href="/settings/accounts"
                    className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    Manage <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
              <AccountSection title="Cash & Savings"  accounts={byGroup.cash}       total={totals.cash}       cardNameMap={cardNameMap} institutionMap={institutionMap} />
              <AccountSection title="Credit Cards"     accounts={byGroup.credit}     total={totals.credit}     isLiability cardNameMap={cardNameMap} institutionMap={institutionMap} />
              <AccountSection title="HSA"              accounts={byGroup.hsa}        total={totals.hsa}        cardNameMap={cardNameMap} institutionMap={institutionMap} />
              <AccountSection title="Retirement"       accounts={byGroup.retirement} total={totals.retirement} cardNameMap={cardNameMap} institutionMap={institutionMap} />
              <InvestmentSection
                plaidAccounts={byGroup.investment}
                manualAccounts={manualInvest}
                total={totals.investment}
                cardNameMap={cardNameMap}
                institutionMap={institutionMap}
              />
              {/* Prompt to add missing accounts — only shown when no Plaid
                  institutions are linked yet. Once any institution is linked
                  (regardless of whether its accounts have synced into
                  card_balances), this prompt is misleading and gets hidden. */}
              {plaidItemsCount === 0 && (
                <div className="pt-3 mt-1">
                  <Link href="/settings/accounts"
                    className="flex items-center gap-2 text-xs text-primary font-semibold bg-primary/8 rounded-xl px-3 py-2.5">
                    <Building2 size={13} />
                    Connect Chase, Marcus, or Merrill to see all accounts
                    <ChevronRight size={11} className="ml-auto" />
                  </Link>
                </div>
              )}
            </div>

            {/* ── Recent Activity ───────────────────────────────────── */}
            {recentTxs.length > 0 && (
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</p>
                  <Link href="/transactions"
                    className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    All transactions <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="flex flex-col divide-y divide-border/50">
                  {recentTxs.map(tx => <TxRow key={tx.id} tx={tx} acctMap={acctMap} />)}
                </div>
              </div>
            )}

            {/* ── Rewards Points ────────────────────────────────────── */}
            {points.length > 0 && (
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Rewards Points</p>
                  <Link href="/strategy/points"
                    className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    Manage <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="flex items-baseline justify-between mt-2 mb-4">
                  <p className="text-2xl font-extrabold text-foreground">~${fmt(totalPoints)}</p>
                  <Link href="/strategy/deals"
                    className="flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1.5 rounded-xl">
                    <Coins size={11} />Best deals →
                  </Link>
                </div>
                <div className="flex flex-col divide-y divide-border/50">
                  {points.map(p => {
                    const estVal = (p.balance * (p.cpp ?? 1)) / 100;
                    const brand = PROG_BRAND[p.program] ?? { bg: "#6B7280", initials: "?" };
                    return (
                      <div key={p.program} className="py-3 flex items-center gap-3 first:pt-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-extrabold text-white shrink-0"
                          style={{ background: brand.bg }}>
                          {brand.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{p.program}</p>
                          <p className="text-[10px] text-muted-foreground">{p.cpp ?? 1}¢ / pt</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">{fmt(p.balance)}</p>
                          <p className="text-[10px] text-muted-foreground">~${fmt(estVal)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
