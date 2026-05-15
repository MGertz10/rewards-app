"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight, ChevronDown, ChevronUp, Building2, RefreshCw,
  Coins, ArrowUpRight, TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AccountWithHoldings } from "@/app/api/accounts/holdings-with-prices/route";

// ─── Types ─────────────────────────────────────────────────────────────────

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

interface RawTx {
  id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  plaid_account_id: string | null;
}

interface PointsBalance { program: string; balance: number; cpp?: number; }
interface SpendData { expenses: number; categories: Record<string, number>; txCount: number; }
type Tab = "overview" | "spending" | "income" | "portfolio";
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

// ─── Account Classification ────────────────────────────────────────────────

function classifyAccount(b: CardBalance): AcctGroup {
  if (b.account_type === "credit") return "credit";
  if (b.account_subtype === "hsa") return "hsa";
  if (b.account_type === "investment") {
    const sub = (b.account_subtype ?? "").toLowerCase();
    if (sub.includes("401") || sub.includes("ira") || sub.includes("roth") ||
        sub.includes("pension") || sub.includes("retirement")) return "retirement";
    return "investment";
  }
  if (b.account_type === "depository") return "cash";
  if (b.credit_limit !== null) return "credit";
  const n = (b.name ?? "").toLowerCase();
  if (n.includes("401") || n.includes("roth") || n.match(/\bira\b/) ||
      n.includes("retirement") || n.includes("pension") || n.includes("403b")) return "retirement";
  if (n.includes("hsa") || n.includes("health savings")) return "hsa";
  if (n.includes("brokerage") || n.includes("invest") || n.includes("portfolio") ||
      n.includes("etrade") || n.includes("schwab") || n.includes("fidelity") ||
      n.includes("merrill") || n.includes("vanguard") || n.includes("ubs") || n.includes("robinhood"))
    return "investment";
  return "cash";
}

// ─── Branding ──────────────────────────────────────────────────────────────

function getBrand(name: string | null) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("chase"))       return { bg: "#117ACA", fg: "#fff", initials: "C"  };
  if (n.includes("capital one")) return { bg: "#C41230", fg: "#fff", initials: "C1" };
  if (n.includes("fidelity"))    return { bg: "#52B043", fg: "#fff", initials: "Fi" };
  if (n.includes("merrill") || n.includes("bofa") || n.includes("bank of america"))
                                 return { bg: "#D70015", fg: "#fff", initials: "ML" };
  if (n.includes("marcus") || n.includes("goldman"))
                                 return { bg: "#1A1A1A", fg: "#fff", initials: "GS" };
  if (n.includes("schwab"))      return { bg: "#0577B6", fg: "#fff", initials: "CS" };
  if (n.includes("vanguard"))    return { bg: "#811A24", fg: "#fff", initials: "VG" };
  if (n.includes("ubs"))         return { bg: "#E40046", fg: "#fff", initials: "UB" };
  if (n.includes("inspira"))     return { bg: "#1E5A96", fg: "#fff", initials: "In" };
  if (n.includes("wells"))       return { bg: "#D71E28", fg: "#fff", initials: "WF" };
  if (n.includes("ally"))        return { bg: "#6B21A8", fg: "#fff", initials: "Al" };
  if (n.includes("discover"))    return { bg: "#F76F20", fg: "#fff", initials: "Di" };
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

// ─── Category emoji ────────────────────────────────────────────────────────

const EMOJI: Record<string, string> = {
  Food: "🍽️", Drinks: "🍺", Housing: "🏠", Transportation: "🚗",
  Entertainment: "🎬", Travel: "✈️", "Personal Care": "💇", Health: "❤️",
  Gifts: "🎁", Shopping: "🛍️", Services: "⚙️", "AI Spend": "🤖", Other: "💸",
  FOOD_AND_DRINK: "🍽️", TRANSPORTATION: "🚗", ENTERTAINMENT: "🎬",
  PERSONAL_CARE: "💇", TRAVEL: "✈️", RENT_AND_UTILITIES: "🏠",
  MEDICAL: "❤️", GENERAL_MERCHANDISE: "🛍️", SHOPPING: "🛍️",
  GENERAL_SERVICES: "⚙️", INCOME: "💰",
};

const PROG_BRAND: Record<string, { bg: string; initials: string }> = {
  "Chase UR":        { bg: "#117ACA", initials: "C"  },
  "Capital One":     { bg: "#C41230", initials: "C1" },
  "Marriott Bonvoy": { bg: "#8B0000", initials: "MB" },
  "Amex MR":         { bg: "#C9A84C", initials: "AX" },
};

// ─── Reusable components ───────────────────────────────────────────────────

function AccountRow({ acct }: { acct: CardBalance }) {
  const isCard = classifyAccount(acct) === "credit";
  const bal = acct.current_balance ?? 0;
  const util = acct.utilization_pct;
  const utilColor = util != null
    ? (util > 30 ? "text-destructive" : util > 9 ? "text-warning" : "text-success") : "";
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar name={acct.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {acct.name ?? "Account"}
          {acct.mask && <span className="text-muted-foreground/60 text-xs"> ···{acct.mask}</span>}
        </p>
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

// Collapsible account group — hooks at top level of THIS component, not inline
function AccountSection({
  title, accounts, total, isLiability,
}: {
  title: string; accounts: CardBalance[]; total: number; isLiability?: boolean;
}) {
  const [open, setOpen] = useState(true);
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
          {accounts.map(a => <AccountRow key={a.plaid_account_id} acct={a} />)}
        </div>
      )}
    </div>
  );
}

// Investment section with manual accounts + holdings — proper component
function InvestmentSection({
  plaidAccounts, manualAccounts, total,
}: {
  plaidAccounts: CardBalance[];
  manualAccounts: AccountWithHoldings[];
  total: number;
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
          <span className="text-xs font-bold text-foreground">Investment</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">${fmt(total)}</span>
          {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="pb-1 divide-y divide-border/40">
          {plaidAccounts.map(a => <AccountRow key={a.plaid_account_id} acct={a} />)}
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
                      {a.liveValue !== null && <span className="text-[9px] font-bold bg-success/10 text-success px-1 py-0.5 rounded-full">Live</span>}
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
}

function MonthPicker({ selected, onChange }: { selected: string; onChange: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const months: Array<{ yyyyMM: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      yyyyMM: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }
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

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-border bg-background sticky top-0 z-10">
      {(["overview","spending","income","portfolio"] as Tab[]).map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 capitalize ${
            active === t ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
          }`}>
          {t === "spending" ? "Expenses" : t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

function TxRow({ tx, acctMap }: { tx: RawTx; acctMap: Record<string, string | null> }) {
  const acctName = acctMap[tx.plaid_account_id ?? ""] ?? null;
  const brand = getBrand(acctName);
  const isDebit = tx.amount > 0;
  return (
    <div className="py-3 flex items-center gap-3 first:pt-0">
      <span className="text-lg w-7 text-center shrink-0">{EMOJI[tx.category ?? ""] ?? "💸"}</span>
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
      <p className={`text-sm font-bold shrink-0 ${isDebit ? "text-foreground" : "text-success"}`}>
        {isDebit ? "−" : "+"}${fmt(Math.abs(tx.amount), 2)}
      </p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab, setTab]                       = useState<Tab>("overview");
  const [balances, setBalances]             = useState<CardBalance[]>([]);
  const [manualAccounts, setManualAccounts] = useState<AccountWithHoldings[]>([]);
  const [recentTxs, setRecentTxs]           = useState<RawTx[]>([]);
  const [points, setPoints]                 = useState<PointsBalance[]>([]);
  const [spend, setSpend]                   = useState<SpendData | null>(null);
  const [income, setIncome]                 = useState<RawTx[]>([]);
  const [spendMonth, setSpendMonth]         = useState(currentYYYYMM());
  const [spendLoading, setSpendLoading]     = useState(false);
  const [lastSync, setLastSync]             = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);

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
        .gt("amount", 0)
        .order("posted_at", { ascending: false })
        .limit(8),
      fetch("/api/points-balances").then(r => r.json()).catch(() => ({ balances: [] })),
    ]).then(([{ data: bals }, holdingsRes, { data: txs }, pointsRes]) => {
      if (bals) {
        setBalances(bals);
        const times = bals.map((b: CardBalance) => b.as_of).filter(Boolean) as string[];
        if (times.length) {
          const latest = times.sort().at(-1)!;
          setLastSync(new Date(latest).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
        }
      }
      if (holdingsRes?.accounts) setManualAccounts(holdingsRes.accounts);
      if (txs) setRecentTxs(txs);
      if (pointsRes?.balances) setPoints(pointsRes.balances);
      setLoading(false);
    });
  }, []);

  const fetchMonthData = useCallback((month: string) => {
    setSpend(null);
    setSpendLoading(true);
    const supabase = createClient();
    const [y, m] = month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    Promise.all([
      fetch(`/api/transactions/summary?month=${month}`).then(r => r.json()).catch(() => null),
      supabase
        .from("transactions")
        .select("id,posted_at,amount,merchant_raw,category,plaid_account_id")
        .eq("pending", false)
        .lt("amount", 0)
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS")')
        .gte("posted_at", start)
        .lte("posted_at", end)
        .order("posted_at", { ascending: false }),
    ]).then(([spendRes, { data: incomeTxs }]) => {
      if (spendRes) setSpend(spendRes);
      if (incomeTxs) setIncome(incomeTxs);
      setSpendLoading(false);
    });
  }, []);

  useEffect(() => { fetchMonthData(spendMonth); }, [spendMonth, fetchMonthData]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const byGroup = {
    cash:       balances.filter(b => classifyAccount(b) === "cash"),
    credit:     balances.filter(b => classifyAccount(b) === "credit"),
    investment: balances.filter(b => classifyAccount(b) === "investment"),
    retirement: balances.filter(b => classifyAccount(b) === "retirement"),
    hsa:        balances.filter(b => classifyAccount(b) === "hsa"),
  };
  const manualRetirement = manualAccounts.filter(a => a.account_type === "retirement");
  const manualHsa        = manualAccounts.filter(a => a.account_type === "hsa");
  const manualInvest     = manualAccounts.filter(a => !["retirement","hsa"].includes(a.account_type));

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
  const monthIncome = income.reduce((s, t) => s + Math.abs(t.amount), 0);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto animate-pulse">
        <div className="px-4 pt-5 pb-3"><div className="h-6 w-32 rounded-lg bg-muted mb-1.5" /><div className="h-3 w-24 rounded bg-muted" /></div>
        <div className="h-10 bg-muted" />
        <div className="px-4 pt-4 flex flex-col gap-3">
          <div className="h-36 rounded-2xl bg-muted" />
          <div className="h-48 rounded-2xl bg-muted" />
          <div className="h-40 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  // ── Overview tab ──────────────────────────────────────────────────────────

  const Overview = (
    <div className="flex flex-col gap-4 px-4 pt-4">
      {!hasData && (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 size={28} className="text-primary" />
          </div>
          <p className="font-bold text-lg text-foreground">Connect your accounts</p>
          <p className="text-sm text-muted-foreground max-w-xs">Link your banks and credit cards to see balances, transactions, and net worth.</p>
          <Link href="/settings/accounts" className="bg-primary text-white text-sm font-semibold px-6 py-3 rounded-xl">Connect Accounts</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* NW Hero */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Net Worth</p>
                <Link href="/strategy/projection" className="flex items-center gap-1 text-[10px] text-primary font-semibold">
                  10-yr projection <ArrowUpRight size={10} />
                </Link>
              </div>
              <p className="text-4xl font-extrabold text-foreground tracking-tight mt-1">{fmtK(netWorth)}</p>
              <div className="flex gap-5 mt-3 flex-wrap">
                <div><p className="text-[10px] text-muted-foreground">Assets</p><p className="text-sm font-bold text-success">{fmtK(totalAssets)}</p></div>
                <div className="w-px bg-border" />
                <div><p className="text-[10px] text-muted-foreground">Debt</p><p className="text-sm font-bold text-destructive">{fmtK(totals.credit)}</p></div>
                {totals.cash > 0 && <><div className="w-px bg-border" /><div><p className="text-[10px] text-muted-foreground">Cash</p><p className="text-sm font-bold text-foreground">{fmtK(totals.cash)}</p></div></>}
              </div>
            </div>
            {totalAssets > 0 && (
              <div className="px-5 pb-4 border-t border-border/40 pt-3">
                <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                  {([
                    { val: totals.cash, color: "#117ACA" },
                    { val: totals.hsa,  color: "#22c55e" },
                    { val: totals.retirement, color: "#3b82f6" },
                    { val: totals.investment, color: "#8b5cf6" },
                  ] as { val: number; color: string }[]).filter(s => s.val > 0).map((s, i) => (
                    <div key={i} className="h-full" style={{ width: `${(s.val / totalAssets) * 100}%`, backgroundColor: s.color }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {[
                    { label: "Cash",       val: totals.cash,       color: "#117ACA" },
                    { label: "HSA",        val: totals.hsa,        color: "#22c55e" },
                    { label: "Retirement", val: totals.retirement, color: "#3b82f6" },
                    { label: "Invested",   val: totals.investment, color: "#8b5cf6" },
                  ].filter(s => s.val > 0).map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] text-muted-foreground">{s.label} <span className="font-semibold text-foreground">{fmtK(s.val)}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* All Accounts */}
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">All Accounts</p>
              <Link href="/settings/accounts" className="text-[11px] text-primary font-semibold flex items-center gap-1">
                Manage <ChevronRight size={11} />
              </Link>
            </div>
            <AccountSection title="Cash & Savings"  accounts={byGroup.cash}       total={totals.cash}       />
            <AccountSection title="HSA"              accounts={byGroup.hsa}        total={totals.hsa}        />
            <AccountSection title="Retirement"       accounts={byGroup.retirement} total={totals.retirement} />
            <InvestmentSection
              plaidAccounts={byGroup.investment}
              manualAccounts={manualInvest}
              total={totals.investment}
            />
            <AccountSection title="Credit Cards" accounts={byGroup.credit} total={totals.credit} isLiability />
          </div>

          {/* Recent activity */}
          {recentTxs.length > 0 && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</p>
                <Link href="/transactions" className="text-[11px] text-primary font-semibold flex items-center gap-1">
                  All transactions <ChevronRight size={11} />
                </Link>
              </div>
              <div className="flex flex-col divide-y divide-border/50">
                {recentTxs.map(tx => <TxRow key={tx.id} tx={tx} acctMap={acctMap} />)}
              </div>
            </div>
          )}

          {/* Points */}
          {points.length > 0 && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Rewards Points</p>
                <Link href="/strategy/points" className="text-[11px] text-primary font-semibold flex items-center gap-1">Manage <ChevronRight size={11} /></Link>
              </div>
              <div className="flex items-baseline justify-between mt-2 mb-4">
                <p className="text-2xl font-extrabold text-foreground">~${fmt(totalPoints)}</p>
                <Link href="/strategy/deals" className="flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1.5 rounded-xl">
                  <Coins size={11} />Best deals →
                </Link>
              </div>
              <div className="flex flex-col divide-y divide-border/50">
                {points.map(p => {
                  const estVal = (p.balance * (p.cpp ?? 1)) / 100;
                  const brand = PROG_BRAND[p.program] ?? { bg: "#6B7280", initials: "?" };
                  return (
                    <div key={p.program} className="py-3 flex items-center gap-3 first:pt-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-extrabold text-white shrink-0" style={{ background: brand.bg }}>{brand.initials}</div>
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
  );

  // ── Spending tab ──────────────────────────────────────────────────────────

  const Spending = (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Expenses</p>
            <p className="text-xs text-muted-foreground mt-0.5">{monthLabel(spendMonth)}</p>
          </div>
          <Link href="/transactions" className="text-[11px] text-primary font-semibold flex items-center gap-1">All <ChevronRight size={11} /></Link>
        </div>
        <MonthPicker selected={spendMonth} onChange={setSpendMonth} />
        <div className="mt-4">
          {spendLoading && <div className="animate-pulse flex flex-col gap-2">{[1,2,3,4].map(i=><div key={i} className="h-8 rounded-lg bg-muted"/>)}</div>}
          {!spendLoading && (!spend || spend.txCount === 0) && (
            <div className="py-8 text-center"><p className="text-sm text-muted-foreground">No expenses for this month</p></div>
          )}
          {!spendLoading && spend && spend.txCount > 0 && (
            <>
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-3xl font-extrabold text-foreground">${fmt(spend.expenses)}</p>
                <p className="text-[11px] text-muted-foreground">{spend.txCount} transactions</p>
              </div>
              <div className="flex flex-col gap-3">
                {Object.entries(spend.categories).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
                  const pct = (amt / spend.expenses) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-base w-7 text-center shrink-0">{EMOJI[cat]??"💸"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground">{cat}</span>
                          <span className="text-xs font-bold text-foreground">${fmt(amt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/70" style={{width:`${pct}%`}}/>
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Income tab ────────────────────────────────────────────────────────────

  const Income = (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <div className="mb-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Income</p>
          <p className="text-xs text-muted-foreground mt-0.5">{monthLabel(spendMonth)}</p>
        </div>
        <MonthPicker selected={spendMonth} onChange={setSpendMonth} />
        <div className="mt-4">
          {spendLoading && <div className="animate-pulse flex flex-col gap-2">{[1,2,3].map(i=><div key={i} className="h-10 rounded-lg bg-muted"/>)}</div>}
          {!spendLoading && income.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No income transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">Income appears as credits from connected accounts</p>
            </div>
          )}
          {!spendLoading && income.length > 0 && (
            <>
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-3xl font-extrabold text-success">${fmt(monthIncome)}</p>
                <p className="text-[11px] text-muted-foreground">{income.length} deposits</p>
              </div>
              <div className="flex flex-col divide-y divide-border/50">
                {income.map(tx => <TxRow key={tx.id} tx={tx} acctMap={acctMap} />)}
              </div>
            </>
          )}
        </div>
      </div>
      {spend && income.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Month Summary</p>
          {[
            { label: "Income",  val: monthIncome,                    color: "text-success",     bar: "bg-success"     },
            { label: "Spent",   val: spend.expenses,                  color: "text-destructive", bar: "bg-destructive" },
            { label: "Net",     val: monthIncome - spend.expenses,     color: monthIncome - spend.expenses >= 0 ? "text-success" : "text-destructive", bar: "bg-primary" },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between mb-2.5 last:mb-0">
              <span className="text-sm text-muted-foreground w-14">{r.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden mx-3">
                <div className={`h-full ${r.bar} rounded-full`}
                  style={{ width: `${Math.min(Math.abs(r.val) / Math.max(monthIncome, spend.expenses, 1) * 100, 100)}%` }} />
              </div>
              <span className={`text-sm font-bold ${r.color} w-20 text-right`}>{r.val < 0 ? "−" : ""}${fmt(Math.abs(r.val))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Portfolio tab ─────────────────────────────────────────────────────────

  const Portfolio = (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Total Invested</p>
        <p className="text-3xl font-extrabold text-foreground">{fmtK(totals.investment + totals.retirement + totals.hsa)}</p>
        <div className="flex gap-5 mt-3 flex-wrap">
          {totals.retirement > 0 && <div><p className="text-[10px] text-muted-foreground">Retirement</p><p className="text-sm font-bold text-blue-600">{fmtK(totals.retirement)}</p></div>}
          {totals.investment > 0 && <><div className="w-px bg-border" /><div><p className="text-[10px] text-muted-foreground">Brokerage</p><p className="text-sm font-bold text-violet-600">{fmtK(totals.investment)}</p></div></>}
          {totals.hsa > 0 && <><div className="w-px bg-border" /><div><p className="text-[10px] text-muted-foreground">HSA</p><p className="text-sm font-bold text-emerald-600">{fmtK(totals.hsa)}</p></div></>}
        </div>
      </div>

      {byGroup.retirement.length + manualRetirement.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Retirement</p>
          <div className="flex flex-col divide-y divide-border/50">
            {byGroup.retirement.map(a => <AccountRow key={a.plaid_account_id} acct={a} />)}
            {manualRetirement.map(a => (
              <div key={a.id} className="py-3 flex items-center gap-3 first:pt-0">
                <Avatar name={a.name} size="sm" />
                <p className="flex-1 text-sm font-medium text-foreground truncate">{a.name}</p>
                <p className="text-sm font-semibold text-foreground">${fmt(a.liveValue ?? a.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <InvestmentSection
        plaidAccounts={byGroup.investment}
        manualAccounts={manualInvest}
        total={totals.investment}
      />

      {byGroup.hsa.length + manualHsa.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">HSA</p>
          <div className="flex flex-col divide-y divide-border/50">
            {byGroup.hsa.map(a => <AccountRow key={a.plaid_account_id} acct={a} />)}
            {manualHsa.map(a => (
              <div key={a.id} className="py-3 flex items-center gap-3 first:pt-0">
                <Avatar name={a.name} size="sm" />
                <p className="flex-1 text-sm font-medium text-foreground truncate">{a.name}</p>
                <p className="text-sm font-semibold text-foreground">${fmt(a.liveValue ?? a.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Planning</p>
        <div className="flex flex-col divide-y divide-border/50">
          {[
            { href: "/strategy/projection", label: "NW Projection",   sub: "10-year trajectory" },
            { href: "/dashboard/savings",   label: "Savings Plan",     sub: "Where should your next dollar go?" },
            { href: "/strategy/portfolio",  label: "Portfolio Detail", sub: "Holdings & allocation breakdown" },
          ].map(({ href, label, sub }) => (
            <Link key={href} href={href} className="flex items-center justify-between py-3 first:pt-0 hover:opacity-70 transition-opacity">
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
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          {lastSync && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <RefreshCw size={9} /><span>Synced {lastSync}</span>
            </div>
          )}
        </div>
        <Link href="/strategy/projection" className="flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1.5 rounded-xl">
          <TrendingUp size={11} />Projection
        </Link>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === "overview"  && Overview}
      {tab === "spending"  && Spending}
      {tab === "income"    && Income}
      {tab === "portfolio" && Portfolio}
    </div>
  );
}
