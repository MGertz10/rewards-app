"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/bottom-nav";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Transaction {
  plaid_tx_id: string;
  plaid_account_id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  pending: boolean | null;
}

interface CardBalance {
  plaid_account_id: string;
  name: string | null;
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
function prevMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

// ─── Main page ─────────────────────────────────────────────────────────────

export default function IncomePage() {
  const [month, setMonth]       = useState(currentYYYYMM());
  const [txs, setTxs]           = useState<Transaction[]>([]);
  const [prevTxs, setPrevTxs]   = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<CardBalance[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchData = useCallback((m: string) => {
    setLoading(true);
    const supabase = createClient();
    const [y, mo] = m.split("-").map(Number);
    const start   = `${y}-${String(mo).padStart(2, "0")}-01`;
    const end     = `${y}-${String(mo).padStart(2, "0")}-${new Date(y, mo, 0).getDate()}`;

    const prev = prevMonth(m);
    const [py, pm] = prev.split("-").map(Number);
    const pStart = `${py}-${String(pm).padStart(2, "0")}-01`;
    const pEnd   = `${py}-${String(pm).padStart(2, "0")}-${new Date(py, pm, 0).getDate()}`;

    Promise.all([
      supabase.from("transactions")
        .select("plaid_tx_id,plaid_account_id,posted_at,amount,merchant_raw,category,pending")
        .eq("pending", false)
        .lt("amount", 0)                       // negative = credit/income
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS")')
        .gte("posted_at", start).lte("posted_at", end)
        .order("posted_at", { ascending: false }),
      supabase.from("transactions")
        .select("plaid_tx_id,plaid_account_id,posted_at,amount,merchant_raw,category,pending")
        .eq("pending", false)
        .lt("amount", 0)
        .not("category", "in", '("TRANSFER_IN","TRANSFER_OUT","PAYMENT","LOAN_PAYMENTS")')
        .gte("posted_at", pStart).lte("posted_at", pEnd),
      supabase.from("card_balances").select("plaid_account_id,name"),
    ]).then(([{ data: cur }, { data: prev_ }, { data: accts }]) => {
      if (cur) setTxs(cur);
      if (prev_) setPrevTxs(prev_);
      if (accts) setAccounts(accts);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(month); }, [month, fetchData]);

  const acctMap = Object.fromEntries(accounts.map(a => [a.plaid_account_id, a.name]));
  const total     = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const prevTotal = prevTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const delta     = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  // Source breakdown (by merchant / description)
  const sources: Record<string, number> = {};
  for (const tx of txs) {
    const key = (tx.merchant_raw ?? "Other income").split(/\d/)[0].trim();
    sources[key] = (sources[key] ?? 0) + Math.abs(tx.amount);
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground mb-3 -ml-0.5 w-fit">
          <ChevronLeft size={16} />Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Income</h1>
      </div>

      <div className="flex flex-col gap-4 px-4">

        {/* Month picker */}
        <MonthPicker selected={month} onChange={setMonth} />

        {/* Total card */}
        {!loading && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{monthLabel(month)}</p>
            <p className="text-4xl font-extrabold text-emerald-500 mt-1">${fmt(total)}</p>
            {delta !== null && (
              <div className="flex items-center gap-1 mt-2">
                {delta >= 0
                  ? <TrendingUp size={13} className="text-emerald-500" />
                  : <TrendingDown size={13} className="text-destructive" />}
                <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs {monthLabel(prevMonth(month))}
                </span>
              </div>
            )}
            <div className="flex gap-4 mt-3 flex-wrap">
              <div>
                <p className="text-[10px] text-muted-foreground">Deposits</p>
                <p className="text-sm font-bold text-foreground">{txs.length}</p>
              </div>
              {prevTotal > 0 && (
                <>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Prior month</p>
                    <p className="text-sm font-bold text-muted-foreground">${fmt(prevTotal)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Source breakdown */}
        {!loading && Object.keys(sources).length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Sources</p>
            <div className="flex flex-col gap-2">
              {Object.entries(sources).sort((a,b) => b[1]-a[1]).map(([src, amt]) => {
                const pct = total > 0 ? (amt / total) * 100 : 0;
                return (
                  <div key={src} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <DollarSign size={13} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">{src}</span>
                        <span className="text-xs font-bold text-foreground">${fmt(amt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction list */}
        {!loading && txs.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Deposits</p>
            </div>
            {txs.map(tx => {
              const acctName = acctMap[tx.plaid_account_id] ?? "Account";
              return (
                <div key={tx.plaid_tx_id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <DollarSign size={14} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {tx.merchant_raw ?? "Deposit"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{acctName}</span>
                      <span className="text-[10px] text-muted-foreground">· {relDate(tx.posted_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-500 shrink-0">
                    +${Math.abs(tx.amount).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="animate-pulse flex flex-col gap-3">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-muted" />)}
          </div>
        )}

        {!loading && txs.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-semibold text-foreground">No income found for {monthLabel(month)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Income shows as credits from your connected accounts.
            </p>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
