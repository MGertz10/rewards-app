"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, ChevronRight,
  CreditCard, ChevronDown, ChevronUp, PieChart, ListOrdered,
  Target, Coins, RefreshCw, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCardNameMap, resolveAccountName } from "@/lib/use-card-name-map";
import type { AccountWithHoldings } from "@/app/api/accounts/holdings-with-prices/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardBalance {
  plaid_account_id: string;
  name: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  utilization_pct: number | null;
  account_type: string | null;
  account_subtype: string | null;
}

interface PlaidSpend {
  expenses: number;
  categories: Record<string, number>;
  txCount: number;
}

interface PointsBalance {
  program: string;
  balance: number;
  cpp?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

// Generate last N calendar months newest-first
function generateMonths(count = 12): Array<{ label: string; yyyyMM: string }> {
  const out: Array<{ label: string; yyyyMM: string }> = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyyMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    out.push({ label, yyyyMM });
  }
  return out; // newest first
}

function currentYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Account classification
function isCreditCard(b: CardBalance) {
  if (b.account_type === "credit") return true;
  if (b.account_subtype?.includes("credit")) return true;
  if (b.credit_limit !== null && b.account_type !== "investment") return true;
  return false;
}

function isHSA(b: CardBalance) {
  return b.account_subtype?.toLowerCase() === "hsa";
}

function isRetirement(b: CardBalance) {
  if (b.account_type !== "investment") return false;
  const sub = (b.account_subtype ?? "").toLowerCase();
  return sub.includes("401") || sub.includes("ira") || sub.includes("roth") ||
         sub.includes("pension") || sub.includes("retirement");
}

function isInvestment(b: CardBalance) {
  return b.account_type === "investment" && !isRetirement(b) && !isHSA(b);
}

function isCash(b: CardBalance) {
  return b.account_type === "depository" && !isHSA(b);
}

// Institution branding — returns a hex color + short label
function institutionStyle(name: string | null): { color: string; bg: string; initials: string } {
  const n = (name ?? "").toLowerCase();
  if (n.includes("chase"))         return { color: "#FFFFFF", bg: "#117ACA", initials: "C" };
  if (n.includes("capital one"))   return { color: "#FFFFFF", bg: "#C41230", initials: "C1" };
  if (n.includes("fidelity"))      return { color: "#FFFFFF", bg: "#52B043", initials: "Fi" };
  if (n.includes("merrill") || n.includes("bofa") || n.includes("bank of america"))
                                   return { color: "#FFFFFF", bg: "#D70015", initials: "ML" };
  if (n.includes("marcus") || n.includes("goldman"))
                                   return { color: "#FFFFFF", bg: "#1A1A1A", initials: "GS" };
  if (n.includes("schwab"))        return { color: "#FFFFFF", bg: "#0577B6", initials: "CS" };
  if (n.includes("vanguard"))      return { color: "#FFFFFF", bg: "#811A24", initials: "VG" };
  if (n.includes("american express") || n.includes("amex"))
                                   return { color: "#FFFFFF", bg: "#007BC1", initials: "AX" };
  if (n.includes("discover"))      return { color: "#FFFFFF", bg: "#F76F20", initials: "Di" };
  if (n.includes("citi"))          return { color: "#FFFFFF", bg: "#056DAE", initials: "Ci" };
  if (n.includes("wells"))         return { color: "#FFFFFF", bg: "#D71E28", initials: "WF" };
  if (n.includes("ally"))          return { color: "#000000", bg: "#9400D3", initials: "Al" };
  if (n.includes("sofi"))          return { color: "#FFFFFF", bg: "#7B2D8B", initials: "SF" };
  if (n.includes("inspira"))       return { color: "#FFFFFF", bg: "#1E5A96", initials: "In" };
  return { color: "#FFFFFF", bg: "#6B7280", initials: (name?.[0] ?? "?").toUpperCase() };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InstitutionAvatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" }) {
  const { color, bg, initials } = institutionStyle(name);
  const cls = size === "sm"
    ? "w-7 h-7 rounded-lg text-[9px] font-bold"
    : "w-8 h-8 rounded-xl text-[10px] font-bold";
  return (
    <div
      className={`${cls} flex items-center justify-center shrink-0`}
      style={{ backgroundColor: bg, color }}
    >
      {initials}
    </div>
  );
}

function UtilBar({ pct, limit }: { pct: number | null; limit: number | null }) {
  if (pct === null && limit === null) return null;
  const p = pct ?? 0;
  const color = p > 30 ? "bg-destructive" : p > 9 ? "bg-warning" : "bg-success";
  return (
    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

function MonthPicker({
  months, selected, onSelect,
}: {
  months: Array<{ label: string; yyyyMM: string }>;
  selected: string;
  onSelect: (yyyyMM: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdx = months.findIndex((m) => m.yyyyMM === selected);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const el = c.children[selectedIdx] as HTMLElement | undefined;
    if (!el) return;
    c.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - c.offsetWidth / 2;
  }, [selectedIdx]);

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {months.map((m) => (
          <button
            key={m.yyyyMM}
            onClick={() => onSelect(m.yyyyMM)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              m.yyyyMM === selected
                ? "bg-primary text-white"
                : "bg-card border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

function AccountRow({ acct, expanded, onToggle }: {
  acct: CardBalance;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const bal = acct.current_balance ?? 0;
  const isCard = isCreditCard(acct);
  const util = acct.utilization_pct;
  const utilColor = util !== null
    ? util > 30 ? "text-destructive" : util > 9 ? "text-warning" : "text-success"
    : "";

  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <InstitutionAvatar name={acct.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {acct.name ?? "Account"}
            {acct.mask && <span className="text-muted-foreground font-normal"> ···{acct.mask}</span>}
          </p>
          {isCard && util !== null && (
            <p className={`text-[10px] font-medium ${utilColor}`}>{util}% utilization</p>
          )}
          {!isCard && acct.available_balance !== null && acct.available_balance !== bal && (
            <p className="text-[10px] text-muted-foreground">Avail ${fmt(acct.available_balance)}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${isCard ? "text-destructive" : "text-foreground"}`}>
            {isCard ? "-" : ""}${fmt(bal)}
          </p>
        </div>
        {onToggle !== undefined && (
          <button onClick={onToggle} className="p-0.5">
            {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
          </button>
        )}
      </div>
      {isCard && <UtilBar pct={util} limit={acct.credit_limit} />}
    </div>
  );
}

function AccountSection({
  title, accounts, total, isLiability = false, defaultOpen = true,
}: {
  title: string;
  accounts: CardBalance[];
  total: number;
  isLiability?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (accounts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-foreground">{title}</p>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {accounts.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isLiability ? "text-destructive" : "text-foreground"}`}>
            {isLiability ? "-" : ""}${fmt(total)}
          </span>
          {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 divide-y divide-border/50">
          {accounts.map((acct) => (
            <AccountRow key={acct.plaid_account_id} acct={acct} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpendRow({ category, amount, total }: { category: string; amount: number; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const EMOJI: Record<string, string> = {
    Food: "🍽️", Drinks: "🍺", Housing: "🏠", Transportation: "🚗",
    Entertainment: "🎬", Travel: "✈️", "Personal Care": "💇", Health: "❤️",
    Gifts: "🎁", Shopping: "🛍️", Services: "⚙️", "AI Spend": "🤖", Other: "💸",
  };
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-base w-6 shrink-0 text-center">{EMOJI[category] ?? "💸"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">{category}</span>
          <span className="text-xs font-bold text-foreground">${fmt(amount)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [cardBalances, setCardBalances] = useState<CardBalance[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<AccountWithHoldings[]>([]);
  const [expandedInvestment, setExpandedInvestment] = useState<Set<string>>(new Set());
  const [plaidSpend, setPlaidSpend] = useState<PlaidSpend | null>(null);
  const [spendLoading, setSpendLoading] = useState(false);
  const [pointsBalances, setPointsBalances] = useState<PointsBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const months = generateMonths(12);
  const [selectedMonth, setSelectedMonth] = useState(currentYYYYMM());
  const isCurrentMonth = selectedMonth === currentYYYYMM();

  const cardNameMap = useCardNameMap();

  // Load Plaid balances + manual investment accounts
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("card_balances")
        .select("plaid_account_id, name, mask, current_balance, available_balance, credit_limit, utilization_pct, account_type, account_subtype, as_of")
        .order("account_type")
        .order("name"),
      fetch("/api/accounts/holdings-with-prices").then((r) => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/points-balances").then((r) => r.json()).catch(() => ({ balances: [] })),
    ]).then(([{ data: balances }, holdingsRes, pointsRes]) => {
      if (balances) {
        setCardBalances(balances);
        // Extract most recent sync time
        const times = (balances as Array<CardBalance & { as_of?: string }>)
          .map((b) => (b as unknown as { as_of?: string }).as_of)
          .filter(Boolean) as string[];
        if (times.length > 0) {
          const latest = times.sort().reverse()[0];
          const d = new Date(latest);
          setLastSync(d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
        }
      }
      if (holdingsRes?.accounts) setInvestmentAccounts(holdingsRes.accounts);
      if (pointsRes?.balances) setPointsBalances(pointsRes.balances);
      setLoading(false);
    });
  }, []);

  // Fetch spending when month changes
  useEffect(() => {
    setPlaidSpend(null);
    setSpendLoading(true);
    fetch(`/api/transactions/summary?month=${selectedMonth}`)
      .then((r) => r.json())
      .then((d: PlaidSpend) => { setPlaidSpend(d); setSpendLoading(false); })
      .catch(() => setSpendLoading(false));
  }, [selectedMonth]);

  // ── Derived values ────────────────────────────────────────────────────────

  const creditCards = cardBalances.filter(isCreditCard);
  const cashAccounts = cardBalances.filter(isCash);
  const hsaAccounts = cardBalances.filter(isHSA);
  const retirementAccounts = cardBalances.filter(isRetirement);
  const investmentPlaid = cardBalances.filter(isInvestment);

  const creditTotal = creditCards.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const cashTotal = cashAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const hsaTotal = hsaAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const retirementTotal = retirementAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const investmentPlaidTotal = investmentPlaid.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const manualInvestTotal = investmentAccounts.reduce((s, a) => s + (a.liveValue ?? a.balance), 0);

  const totalAssets = cashTotal + hsaTotal + retirementTotal + investmentPlaidTotal + manualInvestTotal;
  const netWorth = totalAssets - creditTotal;
  const hasData = cardBalances.length > 0 || investmentAccounts.length > 0;

  const totalPointsValue = pointsBalances.reduce((s, p) => s + ((p.balance * (p.cpp ?? 1)) / 100), 0);

  const spendCategories = plaidSpend
    ? Object.entries(plaidSpend.categories).sort((a, b) => b[1] - a[1])
    : [];
  const totalSpend = plaidSpend?.expenses ?? 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen px-4 pt-6 pb-24 max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your financial snapshot</p>
        </div>
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-36 rounded-2xl bg-muted" />
          <div className="h-10 rounded-xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="h-40 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">

      {/* ── Header ── */}
      <div className="px-4 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your financial snapshot</p>
        </div>
        {lastSync && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
            <RefreshCw size={9} />
            <span>{lastSync}</span>
          </div>
        )}
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* ── No data state ── */}
        {!hasData && (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">No accounts connected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your bank and credit card accounts to see your full financial picture.
              </p>
            </div>
            <Link
              href="/settings/accounts"
              className="mt-1 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Connect Accounts
            </Link>
          </div>
        )}

        {/* ── Net Worth Hero ── */}
        {hasData && (
          <div className="rounded-2xl overflow-hidden border border-border">
            <div className="bg-gradient-to-br from-primary/8 via-background to-background dark:from-primary/15 px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Net Worth</p>
              <p className="text-4xl font-extrabold text-foreground tracking-tight">{fmtK(netWorth)}</p>
              <div className="flex items-center gap-4 mt-2.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-success" />
                  Assets {fmtK(totalAssets)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={10} className="text-destructive" />
                  Debt {fmtK(creditTotal)}
                </span>
              </div>
            </div>
            {/* Asset breakdown mini-bar */}
            {totalAssets > 0 && (
              <div className="px-4 pb-4 pt-1 border-t border-border/40">
                <div className="flex h-2 rounded-full overflow-hidden gap-px mt-3 mb-2">
                  {[
                    { val: cashTotal,           color: "bg-primary" },
                    { val: hsaTotal,             color: "bg-emerald-500" },
                    { val: retirementTotal,      color: "bg-blue-500" },
                    { val: investmentPlaidTotal + manualInvestTotal, color: "bg-violet-500" },
                  ].filter((s) => s.val > 0).map((s, i) => (
                    <div
                      key={i}
                      className={`${s.color} h-full transition-all`}
                      style={{ width: `${(s.val / totalAssets) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    { label: "Cash",       val: cashTotal,           color: "bg-primary" },
                    { label: "HSA",        val: hsaTotal,             color: "bg-emerald-500" },
                    { label: "Retirement", val: retirementTotal,      color: "bg-blue-500" },
                    { label: "Invested",   val: investmentPlaidTotal + manualInvestTotal, color: "bg-violet-500" },
                  ].filter((s) => s.val > 0).map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      <span className="text-[10px] text-muted-foreground">{s.label} {fmtK(s.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Account Sections ── */}
        {hasData && (
          <>
            <AccountSection
              title="Cash & Savings"
              accounts={cashAccounts}
              total={cashTotal}
              defaultOpen
            />
            <AccountSection
              title="HSA"
              accounts={hsaAccounts}
              total={hsaTotal}
              defaultOpen
            />
            <AccountSection
              title="Retirement"
              accounts={retirementAccounts}
              total={retirementTotal}
              defaultOpen
            />

            {/* Investment: Plaid + Manual combined */}
            {(investmentPlaid.length > 0 || investmentAccounts.length > 0) && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground">Investment</p>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {investmentPlaid.length + investmentAccounts.length}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {fmtK(investmentPlaidTotal + manualInvestTotal)}
                  </span>
                </div>
                <div className="border-t border-border px-4 divide-y divide-border/50">
                  {investmentPlaid.map((acct) => (
                    <AccountRow key={acct.plaid_account_id} acct={acct} />
                  ))}
                  {investmentAccounts.map((acct) => {
                    const val = acct.liveValue ?? acct.balance;
                    const isExp = expandedInvestment.has(acct.id);
                    return (
                      <div key={acct.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <InstitutionAvatar name={acct.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-foreground truncate">{acct.name}</p>
                              {acct.liveValue !== null && (
                                <span className="text-[9px] font-bold bg-success/10 text-success px-1 py-0.5 rounded-full">Live</span>
                              )}
                            </div>
                            {acct.institution && (
                              <p className="text-[10px] text-muted-foreground">{acct.institution}</p>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground shrink-0">${fmt(val)}</p>
                          {acct.holdings.length > 0 && (
                            <button
                              onClick={() => setExpandedInvestment((prev) => {
                                const next = new Set(prev);
                                if (next.has(acct.id)) next.delete(acct.id); else next.add(acct.id);
                                return next;
                              })}
                              className="p-0.5"
                            >
                              {isExp
                                ? <ChevronUp size={13} className="text-muted-foreground" />
                                : <ChevronDown size={13} className="text-muted-foreground" />}
                            </button>
                          )}
                        </div>
                        {isExp && acct.holdings.length > 0 && (
                          <div className="mt-2 bg-muted/30 rounded-xl px-3 py-2 flex flex-col gap-2">
                            {acct.holdings.map((h) => (
                              <div key={h.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-foreground">{h.ticker ?? "—"}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">{h.name}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {h.shares} shares{h.livePrice !== null && ` · $${fmt(h.livePrice, 2)}/sh`}
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-semibold text-foreground">
                                    {h.liveValue !== null ? `$${fmt(h.liveValue)}` : "—"}
                                  </p>
                                  {h.gainLoss !== null && (
                                    <p className={`text-[10px] ${h.gainLoss >= 0 ? "text-success" : "text-destructive"}`}>
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
                <div className="border-t border-border/40 px-4 py-2">
                  <Link href="/settings/accounts" className="text-[11px] text-primary font-medium flex items-center gap-1">
                    Manage accounts & holdings <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            <AccountSection
              title="Credit Cards"
              accounts={creditCards}
              total={creditTotal}
              isLiability
              defaultOpen
            />
          </>
        )}

        {/* ── Points summary ── */}
        {pointsBalances.length > 0 && (
          <Link href="/strategy/points" className="rounded-2xl border border-border bg-card p-4 block hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Coins size={14} className="text-amber-600" />
                </div>
                <p className="text-xs font-bold text-foreground">Rewards Points</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-amber-600">~${fmt(totalPointsValue)}</span>
                <ChevronRight size={13} className="text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {pointsBalances.slice(0, 3).map((p) => (
                <div key={p.program} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{p.program}</span>
                  <span className="text-xs font-semibold text-foreground">{fmt(p.balance)} pts</span>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* ── Monthly Spending ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Monthly Spending</p>
            <MonthPicker months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
          </div>

          <div className="border-t border-border px-4 pb-4 pt-3">
            {spendLoading && (
              <div className="flex flex-col gap-2 animate-pulse">
                <div className="h-4 rounded bg-muted w-full" />
                <div className="h-4 rounded bg-muted w-4/5" />
                <div className="h-4 rounded bg-muted w-3/5" />
              </div>
            )}
            {!spendLoading && (!plaidSpend || plaidSpend.txCount === 0) && (
              <div className="text-center py-6">
                <p className="text-sm font-medium text-muted-foreground">No transactions found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isCurrentMonth ? "Sync accounts to see this month's spending" : "No data for this month"}
                </p>
                {isCurrentMonth && (
                  <Link href="/settings/accounts" className="text-xs text-primary font-medium mt-2 inline-block">
                    Sync accounts →
                  </Link>
                )}
              </div>
            )}
            {!spendLoading && plaidSpend && plaidSpend.txCount > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{plaidSpend.txCount} transactions</span>
                  <span className="text-sm font-bold text-foreground">${fmt(totalSpend)} total</span>
                </div>
                <div className="flex flex-col divide-y divide-border/40">
                  {spendCategories.map(([cat, amt]) => (
                    <SpendRow key={cat} category={cat} amount={amt} total={totalSpend} />
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/60">
                  <Link href="/transactions" className="text-[11px] text-primary font-medium flex items-center gap-1">
                    View all transactions <ChevronRight size={11} />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Financial Tools ── */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Financial Tools</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/strategy/projection", icon: TrendingUp,  label: "NW Projection",  sub: "10-year trajectory"     },
              { href: "/strategy/portfolio",  icon: PieChart,    label: "Portfolio",       sub: "Holdings & allocation"  },
              { href: "/strategy/invest",     icon: Target,      label: "Invest & Save",   sub: "Account breakdown"      },
              { href: "/dashboard/savings",   icon: PiggyBank,   label: "Savings Plan",    sub: "Priority decision tree" },
              { href: "/transactions",        icon: ListOrdered, label: "Transactions",    sub: "All accounts"           },
              { href: "/strategy/credit",     icon: CreditCard,  label: "Credit Score",    sub: "Utilization & 5/24"     },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
