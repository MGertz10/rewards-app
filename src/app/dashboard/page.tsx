"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, ChevronRight, CreditCard,
  ChevronDown, ChevronUp, Building2, RefreshCw, ArrowUpRight,
  Coins, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCardNameMap } from "@/lib/use-card-name-map";
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
  as_of?: string;
}

interface RawTransaction {
  id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  plaid_account_id: string | null;
}

interface PointsBalance {
  program: string;
  balance: number;
  cpp?: number;
}

interface SpendData {
  expenses: number;
  categories: Record<string, number>;
  txCount: number;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const diffMs = today.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function prevMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Account classification ───────────────────────────────────────────────────

function isCreditCard(b: CardBalance) {
  if (b.account_type === "credit") return true;
  if (b.account_subtype?.includes("credit")) return true;
  if (b.credit_limit !== null && b.account_type !== "investment") return true;
  return false;
}
function isHSA(b: CardBalance)        { return b.account_subtype?.toLowerCase() === "hsa"; }
function isRetirement(b: CardBalance) {
  if (b.account_type !== "investment") return false;
  const s = (b.account_subtype ?? "").toLowerCase();
  return s.includes("401") || s.includes("ira") || s.includes("roth") || s.includes("pension") || s.includes("retirement");
}
function isInvestment(b: CardBalance) { return b.account_type === "investment" && !isRetirement(b) && !isHSA(b); }
function isCash(b: CardBalance)       { return b.account_type === "depository" && !isHSA(b); }

// ─── Institution branding ────────────────────────────────────────────────────

function getBrand(name: string | null): { bg: string; fg: string; initials: string } {
  const n = (name ?? "").toLowerCase();
  if (n.includes("chase"))          return { bg: "#117ACA", fg: "#fff", initials: "C"  };
  if (n.includes("capital one"))    return { bg: "#C41230", fg: "#fff", initials: "C1" };
  if (n.includes("fidelity"))       return { bg: "#52B043", fg: "#fff", initials: "Fi" };
  if (n.includes("merrill") || n.includes("bofa") || n.includes("bank of america"))
                                    return { bg: "#D70015", fg: "#fff", initials: "ML" };
  if (n.includes("marcus") || n.includes("goldman"))
                                    return { bg: "#1A1A1A", fg: "#fff", initials: "GS" };
  if (n.includes("schwab"))         return { bg: "#0577B6", fg: "#fff", initials: "CS" };
  if (n.includes("vanguard"))       return { bg: "#811A24", fg: "#fff", initials: "VG" };
  if (n.includes("amex") || n.includes("american express"))
                                    return { bg: "#007BC1", fg: "#fff", initials: "AX" };
  if (n.includes("discover"))       return { bg: "#F76F20", fg: "#fff", initials: "Di" };
  if (n.includes("wells"))          return { bg: "#D71E28", fg: "#fff", initials: "WF" };
  if (n.includes("inspira"))        return { bg: "#1E5A96", fg: "#fff", initials: "In" };
  if (n.includes("ally"))           return { bg: "#6B21A8", fg: "#fff", initials: "Al" };
  return { bg: "#6B7280", fg: "#fff", initials: (name?.[0] ?? "?").toUpperCase() };
}

function Avatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" | "lg" }) {
  const { bg, fg, initials } = getBrand(name);
  const cls = size === "sm"  ? "w-7 h-7 rounded-lg text-[9px]"
            : size === "lg"  ? "w-10 h-10 rounded-xl text-xs"
            : "w-8 h-8 rounded-xl text-[10px]";
  return (
    <div className={`${cls} flex items-center justify-center font-extrabold shrink-0`} style={{ background: bg, color: fg }}>
      {initials}
    </div>
  );
}

// ─── Category display ─────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  FOOD_AND_DRINK: "🍽️", TRANSPORTATION: "🚗", ENTERTAINMENT: "🎬",
  PERSONAL_CARE: "💇", TRAVEL: "✈️", RENT_AND_UTILITIES: "🏠",
  MEDICAL: "❤️", HOME_IMPROVEMENT: "🔨", GENERAL_MERCHANDISE: "🛍️",
  SHOPPING: "🛍️", GENERAL_SERVICES: "⚙️", INCOME: "💰",
  LOAN_PAYMENTS: "💳", PAYMENT: "💳", TRANSFER_IN: "↩️", TRANSFER_OUT: "↪️",
  BANK_FEES: "🏦", INVESTMENTS: "📈",
};

const LABEL_EMOJI: Record<string, string> = {
  Food: "🍽️", Drinks: "🍺", Housing: "🏠", Transportation: "🚗",
  Entertainment: "🎬", Travel: "✈️", "Personal Care": "💇", Health: "❤️",
  Gifts: "🎁", Shopping: "🛍️", Services: "⚙️", "AI Spend": "🤖",
  Other: "💸", Income: "💰",
};

function catEmoji(plaidCat: string | null, fallback?: string) {
  if (plaidCat && CAT_EMOJI[plaidCat]) return CAT_EMOJI[plaidCat];
  if (fallback && LABEL_EMOJI[fallback]) return LABEL_EMOJI[fallback];
  return "💸";
}

function cleanMerchant(raw: string | null): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/\*+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\d{6,}/g, "")
    .replace(/[#]\d+/g, "")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
      {right}
    </div>
  );
}

function AccountGroup({
  title, accounts, total, isLiability, defaultOpen = true,
}: {
  title: string; accounts: CardBalance[]; total: number;
  isLiability?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!accounts.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{accounts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isLiability ? "text-destructive" : "text-foreground"}`}>
            {isLiability ? "−" : ""}${fmt(total)}
          </span>
          {open ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-0 pl-1 border-l-2 border-border/50 ml-1 mb-2">
          {accounts.map((a) => {
            const bal = a.current_balance ?? 0;
            const util = a.utilization_pct;
            const isCard = isCreditCard(a);
            const utilColor = util !== null ? (util > 30 ? "text-destructive" : util > 9 ? "text-warning" : "text-success") : "";
            return (
              <div key={a.plaid_account_id} className="flex items-center gap-3 py-2.5 pl-3">
                <Avatar name={a.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {a.name ?? "Account"}
                    {a.mask && <span className="text-muted-foreground/70"> ···{a.mask}</span>}
                  </p>
                  {isCard && util !== null && (
                    <p className={`text-[10px] font-medium ${utilColor}`}>{util}% util</p>
                  )}
                  {!isCard && a.available_balance !== null && a.available_balance !== bal && (
                    <p className="text-[10px] text-muted-foreground">Avail ${fmt(a.available_balance)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${isCard ? "text-destructive" : "text-foreground"}`}>
                    {isCard ? "−" : ""}${fmt(bal)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthPicker({ selected, onChange }: { selected: string; onChange: (m: string) => void }) {
  const months: Array<{ yyyyMM: string; label: string }> = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const yyyyMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ yyyyMM, label: d.toLocaleDateString("en-US", { month: "short" }) });
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {months.map((m) => (
        <button
          key={m.yyyyMM}
          onClick={() => onChange(m.yyyyMM)}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            m.yyyyMM === selected
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [balances, setBalances]           = useState<CardBalance[]>([]);
  const [manualAccounts, setManualAccounts] = useState<AccountWithHoldings[]>([]);
  const [transactions, setTransactions]   = useState<RawTransaction[]>([]);
  const [points, setPoints]               = useState<PointsBalance[]>([]);
  const [spend, setSpend]                 = useState<SpendData | null>(null);
  const [spendMonth, setSpendMonth]       = useState(currentYYYYMM());
  const [spendLoading, setSpendLoading]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [expandedInvest, setExpandedInvest] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync]           = useState<string | null>(null);
  const cardNameMap = useCardNameMap();
  void cardNameMap; // available for future account name resolution

  // Load everything in parallel on mount
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("card_balances")
        .select("plaid_account_id,name,mask,current_balance,available_balance,credit_limit,utilization_pct,account_type,account_subtype,as_of")
        .order("name"),
      fetch("/api/accounts/holdings-with-prices").then(r => r.json()).catch(() => ({ accounts: [] })),
      supabase
        .from("transactions")
        .select("id,posted_at,amount,merchant_raw,category,plaid_account_id")
        .eq("pending", false)
        .order("posted_at", { ascending: false })
        .limit(8),
      fetch("/api/points-balances").then(r => r.json()).catch(() => ({ balances: [] })),
    ]).then(([{ data: bals }, holdingsRes, { data: txs }, pointsRes]) => {
      if (bals) {
        setBalances(bals);
        const times = bals.map((b: CardBalance & { as_of?: string }) => b.as_of).filter(Boolean) as string[];
        if (times.length) {
          const latest = times.sort().at(-1)!;
          setLastSync(new Date(latest).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
        }
      }
      if (holdingsRes?.accounts) setManualAccounts(holdingsRes.accounts);
      if (txs) setTransactions(txs);
      if (pointsRes?.balances) setPoints(pointsRes.balances);
      setLoading(false);
    });
  }, []);

  // Fetch spend summary when month changes
  useEffect(() => {
    setSpend(null);
    setSpendLoading(true);
    fetch(`/api/transactions/summary?month=${spendMonth}`)
      .then(r => r.json())
      .then((d: SpendData) => { setSpend(d); setSpendLoading(false); })
      .catch(() => setSpendLoading(false));
  }, [spendMonth]);

  // ── Derived: NW ──────────────────────────────────────────────────────────────
  const creditCards   = balances.filter(isCreditCard);
  const cashAccounts  = balances.filter(isCash);
  const hsaAccounts   = balances.filter(isHSA);
  const retAccounts   = balances.filter(isRetirement);
  const invPlaid      = balances.filter(isInvestment);

  const creditTotal = creditCards.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const cashTotal   = cashAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const hsaTotal    = hsaAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const retTotal    = retAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const invPlaidTotal = invPlaid.reduce((s, b) => s + (b.current_balance ?? 0), 0);
  const manualTotal = manualAccounts.reduce((s, a) => s + (a.liveValue ?? a.balance), 0);

  const totalAssets = cashTotal + hsaTotal + retTotal + invPlaidTotal + manualTotal;
  const netWorth    = totalAssets - creditTotal;
  const hasData     = balances.length > 0 || manualAccounts.length > 0;

  const totalPointsValue = points.reduce((s, p) => s + ((p.balance * (p.cpp ?? 1)) / 100), 0);

  // Build account name lookup for transactions
  const acctNameMap = Object.fromEntries(balances.map(b => [b.plaid_account_id, b.name]));

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen px-4 pt-6 pb-24 max-w-lg mx-auto animate-pulse">
        <div className="h-6 w-32 rounded-lg bg-muted mb-1" />
        <div className="h-4 w-24 rounded bg-muted mb-5" />
        <div className="h-40 rounded-2xl bg-muted mb-3" />
        <div className="h-32 rounded-2xl bg-muted mb-3" />
        <div className="h-48 rounded-2xl bg-muted mb-3" />
        <div className="h-40 rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">

      {/* ── Header ── */}
      <div className="px-4 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{greeting()}</h1>
          <p className="text-muted-foreground text-sm">Here's your financial snapshot</p>
        </div>
        {lastSync && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 bg-muted px-2 py-1 rounded-full">
            <RefreshCw size={9} />
            <span>{lastSync}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 px-4">

        {/* ━━━ NO DATA STATE ━━━ */}
        {!hasData && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Connect your accounts</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Link your banks and cards to see your full financial picture — balances, transactions, and net worth in one place.
              </p>
            </div>
            <Link
              href="/settings/accounts"
              className="bg-primary text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Connect Accounts
            </Link>
          </div>
        )}

        {/* ━━━ NET WORTH HERO ━━━ */}
        {hasData && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Main NW number */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Net Worth</p>
                <Link href="/strategy/projection" className="flex items-center gap-1 text-[10px] text-primary font-semibold">
                  Projection <ArrowUpRight size={10} />
                </Link>
              </div>
              <p className="text-4xl font-extrabold text-foreground tracking-tight mt-1">{fmtK(netWorth)}</p>

              {/* Quick stats row */}
              <div className="flex gap-4 mt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Assets</p>
                  <p className="text-sm font-bold text-success">{fmtK(totalAssets)}</p>
                </div>
                <div className="w-px bg-border" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Debt</p>
                  <p className="text-sm font-bold text-destructive">{fmtK(creditTotal)}</p>
                </div>
                {spend?.expenses && spend.expenses > 0 && (
                  <>
                    <div className="w-px bg-border" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">This Month</p>
                      <p className="text-sm font-bold text-foreground">{fmtK(spend.expenses)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Asset allocation bar */}
            {totalAssets > 0 && (() => {
              const slices = [
                { label: "Cash",       val: cashTotal,            color: "#117ACA" },
                { label: "HSA",        val: hsaTotal,             color: "#22c55e" },
                { label: "Retirement", val: retTotal,             color: "#3b82f6" },
                { label: "Invested",   val: invPlaidTotal + manualTotal, color: "#8b5cf6" },
              ].filter(s => s.val > 0);

              return (
                <div className="px-5 pb-5 border-t border-border/50 pt-4">
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                    {slices.map(s => (
                      <div
                        key={s.label}
                        className="h-full transition-all"
                        style={{ width: `${(s.val / totalAssets) * 100}%`, backgroundColor: s.color }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                    {slices.map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] text-muted-foreground">{s.label} <span className="text-foreground font-medium">{fmtK(s.val)}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ━━━ ACCOUNTS ━━━ */}
        {hasData && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <SectionHeader title="Accounts" right={
              <Link href="/settings/accounts" className="text-[11px] text-primary font-semibold flex items-center gap-1">
                Manage <ChevronRight size={11} />
              </Link>
            } />

            <AccountGroup title="Cash & Savings" accounts={cashAccounts} total={cashTotal} />
            <AccountGroup title="HSA" accounts={hsaAccounts} total={hsaTotal} />
            <AccountGroup title="Retirement" accounts={retAccounts} total={retTotal} />

            {/* Investment: Plaid rows + manual with expandable holdings */}
            {(invPlaid.length > 0 || manualAccounts.length > 0) && (() => {
              const allInvest = invPlaid.length + manualAccounts.length;
              const [open, setOpen] = useState(true);
              return (
                <div>
                  <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Investment</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{allInvest}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">${fmt(invPlaidTotal + manualTotal)}</span>
                      {open ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                    </div>
                  </button>
                  {open && (
                    <div className="flex flex-col gap-0 pl-1 border-l-2 border-border/50 ml-1 mb-2">
                      {invPlaid.map(a => (
                        <div key={a.plaid_account_id} className="flex items-center gap-3 py-2.5 pl-3">
                          <Avatar name={a.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {a.name ?? "Account"}{a.mask && <span className="text-muted-foreground/70"> ···{a.mask}</span>}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">${fmt(a.current_balance ?? 0)}</p>
                        </div>
                      ))}
                      {manualAccounts.map(a => {
                        const val = a.liveValue ?? a.balance;
                        const isExp = expandedInvest.has(a.id);
                        return (
                          <div key={a.id} className="pl-3">
                            <div className="flex items-center gap-3 py-2.5">
                              <Avatar name={a.name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                                  {a.liveValue !== null && (
                                    <span className="text-[9px] font-bold bg-success/10 text-success px-1 py-0.5 rounded-full">Live</span>
                                  )}
                                </div>
                                {a.institution && <p className="text-[10px] text-muted-foreground">{a.institution}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <p className="text-sm font-semibold text-foreground">${fmt(val)}</p>
                                {a.holdings.length > 0 && (
                                  <button
                                    onClick={() => setExpandedInvest(prev => {
                                      const n = new Set(prev);
                                      if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                                      return n;
                                    })}
                                    className="p-0.5"
                                  >
                                    {isExp ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                                  </button>
                                )}
                              </div>
                            </div>
                            {isExp && a.holdings.length > 0 && (
                              <div className="bg-muted/30 rounded-xl px-3 py-2 mb-1.5 flex flex-col gap-1.5">
                                {a.holdings.map(h => (
                                  <div key={h.id} className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-foreground">{h.ticker ?? "—"}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">{h.name}</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">{h.shares} sh{h.livePrice !== null && ` · $${fmt(h.livePrice, 2)}`}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-[11px] font-semibold">{h.liveValue !== null ? `$${fmt(h.liveValue)}` : "—"}</p>
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
                  )}
                </div>
              );
            })()}

            <AccountGroup title="Credit Cards" accounts={creditCards} total={creditTotal} isLiability />
          </div>
        )}

        {/* ━━━ MONTHLY SPENDING ━━━ */}
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Spending</p>
              <p className="text-xs text-muted-foreground mt-0.5">{monthLabel(spendMonth)}</p>
            </div>
            <div className="flex items-center gap-2">
              <MonthPicker selected={spendMonth} onChange={setSpendMonth} />
              <Link href="/transactions" className="text-[11px] text-primary font-semibold flex items-center gap-1 shrink-0">
                All <ChevronRight size={11} />
              </Link>
            </div>
          </div>

          {spendLoading && (
            <div className="flex flex-col gap-2 animate-pulse">
              <div className="h-3 rounded bg-muted w-full" />
              <div className="h-3 rounded bg-muted w-4/5" />
              <div className="h-3 rounded bg-muted w-3/5" />
            </div>
          )}

          {!spendLoading && (!spend || spend.txCount === 0) && (
            <div className="py-6 text-center">
              <Calendar size={24} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No transactions this month yet</p>
              {spendMonth === currentYYYYMM() && (
                <Link href="/settings/accounts" className="text-xs text-primary font-medium mt-1 inline-block">
                  Sync accounts →
                </Link>
              )}
            </div>
          )}

          {!spendLoading && spend && spend.txCount > 0 && (() => {
            const cats = Object.entries(spend.categories).sort((a, b) => b[1] - a[1]).slice(0, 6);
            const maxAmt = Math.max(...cats.map(c => c[1]), 1);
            return (
              <>
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-2xl font-extrabold text-foreground">${fmt(spend.expenses)}</p>
                  <p className="text-[11px] text-muted-foreground">{spend.txCount} transactions</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  {cats.map(([cat, amt]) => {
                    const pct = (amt / maxAmt) * 100;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-base w-6 text-center shrink-0">{LABEL_EMOJI[cat] ?? "💸"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-foreground">{cat}</span>
                            <span className="text-[11px] font-bold text-foreground">${fmt(amt)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        {/* ━━━ RECENT TRANSACTIONS ━━━ */}
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <SectionHeader title="Recent Transactions" right={
            <Link href="/transactions" className="text-[11px] text-primary font-semibold flex items-center gap-1">
              View all <ChevronRight size={11} />
            </Link>
          } />

          {transactions.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No transactions found</p>
              <Link href="/settings/accounts" className="text-xs text-primary font-medium mt-1 inline-block">
                Connect accounts to see activity →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {transactions.map((tx) => {
                const merchant = cleanMerchant(tx.merchant_raw);
                const acctName = acctNameMap[tx.plaid_account_id ?? ""] ?? null;
                const brand = getBrand(acctName);
                const emoji = catEmoji(tx.category);
                const isDebit = tx.amount > 0;
                return (
                  <div key={tx.id} className="py-3 flex items-center gap-3">
                    <span className="text-lg w-7 text-center shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{merchant}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {acctName && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: brand.bg + "22", color: brand.bg }}
                          >
                            {brand.initials}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{relativeDate(tx.posted_at)}</span>
                      </div>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isDebit ? "text-foreground" : "text-success"}`}>
                      {isDebit ? "−" : "+"}${fmt(Math.abs(tx.amount), 2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ━━━ REWARDS POINTS ━━━ */}
        {points.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <SectionHeader title="Rewards Points" right={
              <Link href="/strategy/points" className="text-[11px] text-primary font-semibold flex items-center gap-1">
                Manage <ChevronRight size={11} />
              </Link>
            } />
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-2xl font-extrabold text-foreground">
                  ~${fmt(totalPointsValue)}
                </p>
                <p className="text-[11px] text-muted-foreground">estimated value</p>
              </div>
              <Link href="/strategy/deals" className="flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1.5 rounded-xl">
                <Coins size={11} />
                Best deals →
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-border/50">
              {points.map((p) => {
                const estVal = (p.balance * (p.cpp ?? 1)) / 100;
                const progBrand = {
                  "Chase UR":        { bg: "#117ACA", initials: "C" },
                  "Capital One":     { bg: "#C41230", initials: "C1" },
                  "Marriott Bonvoy": { bg: "#8B0000", initials: "MB" },
                  "Amex MR":         { bg: "#C9A84C", initials: "AX" },
                }[p.program] ?? { bg: "#6B7280", initials: "?" };

                return (
                  <div key={p.program} className="py-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                      style={{ background: progBrand.bg }}
                    >
                      {progBrand.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{p.program}</p>
                      <p className="text-[11px] text-muted-foreground">{p.cpp ?? 1}¢ per point</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{fmt(p.balance)}</p>
                      <p className="text-[11px] text-muted-foreground">~${fmt(estVal)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ━━━ QUICK TOOLS (lean row, not a grid) ━━━ */}
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <SectionHeader title="Tools" />
          <div className="flex flex-col divide-y divide-border/50">
            {[
              { href: "/strategy/projection", label: "NW Projection",  sub: "Where you'll be in 10 years"       },
              { href: "/strategy/portfolio",  label: "Portfolio",       sub: "Holdings & allocation breakdown"   },
              { href: "/dashboard/savings",   label: "Savings Plan",    sub: "Priority decision tree for investing" },
              { href: "/strategy/deals",      label: "Deals & Offers",  sub: "Scored transfer bonuses & card offers" },
              { href: "/strategy/calendar",   label: "Annual Fees",     sub: "Upcoming renewal dates"            },
            ].map(({ href, label, sub }) => (
              <Link key={href} href={href} className="flex items-center justify-between py-3 hover:opacity-70 transition-opacity">
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
