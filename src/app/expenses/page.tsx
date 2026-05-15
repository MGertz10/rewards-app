"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Zap, Receipt,
  UtensilsCrossed, Car, Home, Plane, ShoppingBag, Heart,
  Gamepad2, Coffee, Sparkles, Gift, Bot, Wrench, Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/bottom-nav";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SpendData {
  expenses: number;
  categories: Record<string, number>;
  txCount: number;
}

interface Transaction {
  plaid_tx_id: string;
  plaid_account_id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  pending: boolean | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
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

// ─── Category config ───────────────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const CAT_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  "Food":           { Icon: UtensilsCrossed, color: "#f97316" },
  "Drinks":         { Icon: Coffee,          color: "#a78bfa" },
  "Housing":        { Icon: Home,            color: "#6366f1" },
  "Transportation": { Icon: Car,             color: "#3b82f6" },
  "Entertainment":  { Icon: Gamepad2,        color: "#ec4899" },
  "Travel":         { Icon: Plane,           color: "#0ea5e9" },
  "Personal Care":  { Icon: Sparkles,        color: "#14b8a6" },
  "Health":         { Icon: Heart,           color: "#22c55e" },
  "Gifts":          { Icon: Gift,            color: "#f59e0b" },
  "AI Spend":       { Icon: Bot,             color: "#8b5cf6" },
  "Shopping":       { Icon: ShoppingBag,     color: "#f43f5e" },
  "Services":       { Icon: Wrench,          color: "#64748b" },
  "Other":          { Icon: Package,         color: "#94a3b8" },
};

function mapCategory(plaidCat: string | null, merchant: string | null): string {
  const m = (merchant ?? "").toLowerCase();
  const AI_MERCHANTS = ["openai","chatgpt","anthropic","claude","cursor","perplexity","midjourney","copilot"];
  if (AI_MERCHANTS.some(k => m.includes(k))) return "AI Spend";

  const GROCERY = ["trader joe","whole foods","aldi","mariano","jewel","kroger","safeway","walmart","target","costco"];
  const COFFEE  = ["starbucks","dunkin","dutch bros","caribou","peet's","intelligentsia"];
  const BAR     = ["bar ","tavern","pub ","brewery","brewing","liquor","binny"];

  switch (plaidCat) {
    case "FOOD_AND_DRINK": {
      if (GROCERY.some(g => m.includes(g))) return "Food";
      if (COFFEE.some(c => m.includes(c))) return "Drinks";
      if (BAR.some(b => m.includes(b))) return "Drinks";
      return "Food";
    }
    case "TRANSPORTATION":     return "Transportation";
    case "ENTERTAINMENT":      return "Entertainment";
    case "TRAVEL":             return "Travel";
    case "RENT_AND_UTILITIES": return "Housing";
    case "MEDICAL":            return "Health";
    case "PERSONAL_CARE":      return "Personal Care";
    case "GENERAL_MERCHANDISE":
    case "SHOPPING":           return "Shopping";
    case "GENERAL_SERVICES":   return "Services";
    default:                   return "Other";
  }
}

// ─── Month picker — oldest LEFT, newest RIGHT ──────────────────────────────

function MonthPicker({ selected, onChange }: { selected: string; onChange: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const months: Array<{ yyyyMM: string; label: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      yyyyMM: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);
  return (
    <div ref={ref} className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
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

// ─── View mode ─────────────────────────────────────────────────────────────

type ViewMode = "gross" | "net";

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [month, setMonth]     = useState(currentYYYYMM());
  const [mode, setMode]       = useState<ViewMode>("gross");
  const [spend, setSpend]     = useState<SpendData | null>(null);
  const [txs, setTxs]         = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  // Net overrides: txId → net amount (manually set)
  const [netAmounts, setNetAmounts] = useState<Record<string, number>>({});
  const [editingTx, setEditingTx]   = useState<string | null>(null);
  const [editVal, setEditVal]       = useState("");

  const fetchData = useCallback((m: string) => {
    setLoading(true);
    const supabase = createClient();
    const [y, mo] = m.split("-").map(Number);
    const start   = `${y}-${String(mo).padStart(2, "0")}-01`;
    const end     = `${y}-${String(mo).padStart(2, "0")}-${new Date(y, mo, 0).getDate()}`;

    Promise.all([
      fetch(`/api/transactions/summary?month=${m}`).then(r => r.json()).catch(() => null),
      supabase.from("transactions")
        .select("plaid_tx_id,plaid_account_id,posted_at,amount,merchant_raw,category,pending")
        .eq("pending", false)
        .gt("amount", 0)
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS","INCOME")')
        .gte("posted_at", start).lte("posted_at", end)
        .order("posted_at", { ascending: false }),
    ]).then(([spendRes, { data: txData }]) => {
      if (spendRes) setSpend(spendRes);
      if (txData) setTxs(txData);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(month); }, [month, fetchData]);

  // Load net amounts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("expense_net_amounts_v1");
      if (raw) setNetAmounts(JSON.parse(raw));
    } catch {}
  }, []);

  function saveNet(txId: string, net: number) {
    const updated = { ...netAmounts, [txId]: net };
    setNetAmounts(updated);
    localStorage.setItem("expense_net_amounts_v1", JSON.stringify(updated));
  }

  // Compute totals
  const grossTotal = txs.reduce((s, t) => s + t.amount, 0);
  const netTotal   = txs.reduce((s, t) => {
    const net = netAmounts[t.plaid_tx_id];
    return s + (net != null ? net : t.amount);
  }, 0);

  // Category breakdown from transactions (with net amounts in net mode)
  const catBreakdown: Record<string, number> = {};
  for (const t of txs) {
    const cat = mapCategory(t.category, t.merchant_raw);
    const amt = mode === "net" && netAmounts[t.plaid_tx_id] != null
      ? netAmounts[t.plaid_tx_id] : t.amount;
    if (amt <= 0) continue;
    catBreakdown[cat] = (catBreakdown[cat] ?? 0) + amt;
  }
  const displayTotal = mode === "gross" ? grossTotal : netTotal;

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground mb-3 -ml-0.5 w-fit">
          <ChevronLeft size={16} />Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
      </div>

      <div className="flex flex-col gap-4 px-4">

        {/* Month picker */}
        <MonthPicker selected={month} onChange={setMonth} />

        {/* View mode toggle */}
        <div className="flex rounded-2xl border border-border bg-muted/50 p-1 gap-1">
          <button onClick={() => setMode("gross")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              mode === "gross" ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
            }`}>
            <Zap size={12} />All Spend
          </button>
          <button onClick={() => setMode("net")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              mode === "net" ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
            }`}>
            <Receipt size={12} />Budget Net
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-2 px-0.5">
          {mode === "gross"
            ? "Full purchase amounts — includes shared group expenses before Venmo reimbursements."
            : "Tap any transaction to set your actual out-of-pocket. Useful for group dinners, split bills, etc."}
        </p>

        {/* Totals */}
        {!loading && txs.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{monthLabel(month)}</p>
            <p className="text-4xl font-extrabold text-foreground mt-1">${fmt(displayTotal)}</p>
            <div className="flex gap-4 mt-2 flex-wrap">
              <div>
                <p className="text-[10px] text-muted-foreground">Transactions</p>
                <p className="text-sm font-bold text-foreground">{txs.length}</p>
              </div>
              {mode === "net" && grossTotal !== netTotal && (
                <>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Gross</p>
                    <p className="text-sm font-bold text-muted-foreground">${fmt(grossTotal)}</p>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Reimbursed</p>
                    <p className="text-sm font-bold text-emerald-500">${fmt(grossTotal - netTotal)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {!loading && Object.keys(catBreakdown).length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">By Category</p>
            <div className="flex flex-col gap-3">
              {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                const pct = displayTotal > 0 ? (amt / displayTotal) * 100 : 0;
                const def = CAT_ICON[cat] ?? CAT_ICON["Other"];
                const { Icon, color } = def;
                return (
                  <Link key={cat} href={`/transactions?cat=${encodeURIComponent(cat)}`}
                    className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "18" }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{cat}</span>
                        <span className="text-xs font-bold text-foreground">${fmt(amt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction list with net editing */}
        {!loading && txs.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">All Transactions</p>
              {mode === "net" && (
                <p className="text-[10px] text-muted-foreground">Tap to set net amount</p>
              )}
            </div>
            {txs.map(tx => {
              const cat     = mapCategory(tx.category, tx.merchant_raw);
              const def     = CAT_ICON[cat] ?? CAT_ICON["Other"];
              const { Icon, color } = def;
              const gross   = tx.amount;
              const netAmt  = netAmounts[tx.plaid_tx_id];
              const display = mode === "net" && netAmt != null ? netAmt : gross;
              const hasNet  = netAmt != null && netAmt !== gross;
              const isEditing = editingTx === tx.plaid_tx_id;

              return (
                <div key={tx.plaid_tx_id} className="border-b border-border/40 last:border-0">
                  <button
                    onClick={() => {
                      if (mode !== "net") return;
                      setEditingTx(tx.plaid_tx_id);
                      setEditVal((netAmt ?? gross).toFixed(2));
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "18" }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {tx.merchant_raw ?? "Unknown"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: color + "18", color }}>
                          {cat}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{relDate(tx.posted_at)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {hasNet && mode === "net" ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">${gross.toFixed(2)}</p>
                          <p className="text-sm font-bold text-foreground">${display.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">−${gross.toFixed(2)}</p>
                      )}
                    </div>
                  </button>

                  {/* Inline net editor */}
                  {isEditing && (
                    <div className="px-4 pb-3 flex items-center gap-2 bg-muted/20">
                      <span className="text-sm text-muted-foreground">Net $</span>
                      <input
                        autoFocus
                        type="number"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => {
                          const n = parseFloat(editVal);
                          if (!isNaN(n) && n >= 0) saveNet(tx.plaid_tx_id, n);
                          setEditingTx(null);
                        }}
                        className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                        Save
                      </button>
                      <button onClick={() => setEditingTx(null)}
                        className="text-xs text-muted-foreground font-semibold px-2 py-1.5">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="animate-pulse flex flex-col gap-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-2xl bg-muted" />)}
          </div>
        )}

        {!loading && txs.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-semibold text-foreground">No expenses for {monthLabel(month)}</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different month.</p>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
