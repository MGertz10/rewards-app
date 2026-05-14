"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, CheckCircle, AlertTriangle, Edit3,
  TrendingUp, Zap, DollarSign,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";
import { POINTS_FULL, type PointsBalanceFull } from "@/lib/points-balances";
import { CPP } from "@/lib/cards";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtVal(pts: number, cpp: number) {
  const v = (pts * cpp) / 100;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Drift: how far manual balance is from calculated (earned since last manual)
function driftLabel(manual: number, calculated: number): { label: string; color: string } | null {
  if (calculated === 0) return null;
  const diff = manual - calculated;
  const pct = Math.abs(diff / calculated) * 100;
  if (pct < 5) return { label: "Within 5% — on track ✓", color: "text-emerald-600 dark:text-emerald-400" };
  if (diff > 0) return { label: `+${fmt(diff)} pts over calculated — check for bonuses`, color: "text-amber-500" };
  return { label: `${fmt(diff)} pts under calculated — possible uncounted spend`, color: "text-destructive" };
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditBalanceModal({
  program,
  current,
  onSave,
  onClose,
}: {
  program: PointsBalanceFull;
  current: number;
  onSave: (val: number, notes: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(current.toString());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const n = parseInt(val.replace(/,/g, ""), 10);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    await fetch("/api/points-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program: program.program, balance: n, notes }),
    });
    setSaving(false);
    onSave(n, notes);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">{program.programLabel}</p>
            <p className="text-[11px] text-muted-foreground">Update current balance</p>
          </div>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: program.color + "20" }}>
            <span className="text-base">✈</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Current Balance (points)</label>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full rounded-xl border border-border bg-background text-lg font-bold text-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
          {val && !isNaN(parseInt(val)) && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ≈ {fmtVal(parseInt(val), program.cpp)} at {program.cpp}¢/pt
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. verified in Chase app"
            className="w-full rounded-xl border border-border bg-background text-sm text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save Balance"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Program row ───────────────────────────────────────────────────────────────

function ProgramRow({
  program,
  manualBalance,
  earnedPts,
  onEdit,
}: {
  program: PointsBalanceFull;
  manualBalance: number;
  earnedPts: number;
  onEdit: () => void;
}) {
  const drift = driftLabel(manualBalance, earnedPts);
  const totalValue = (manualBalance * program.cpp) / 100;
  const earnedValue = (earnedPts * program.cpp) / 100;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center gap-3"
        style={{ borderLeft: `4px solid ${program.color}` }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">{program.programLabel}</p>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {program.card}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">{fmt(manualBalance)}</p>
            <p className="text-xs text-muted-foreground">pts · {fmtVal(manualBalance, program.cpp)} value</p>
          </div>
        </div>
        <button onClick={onEdit}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Edit3 size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Earned row */}
      {earnedPts > 0 && (
        <div className="px-4 pb-3.5 pt-1 border-t border-border/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp size={11} className="text-primary" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Earned last 90 days (calculated)
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {fmt(earnedPts)} pts · <span className="text-muted-foreground font-normal">{fmtVal(earnedPts, program.cpp)}</span>
            </p>
            {drift && <p className={`text-[10px] mt-1 ${drift.color}`}>{drift.label}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted-foreground">90-day earn</p>
            <p className="text-xs font-bold" style={{ color: program.color }}>
              +${Math.round(earnedValue)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface StoredBalance { program: string; balance: number; notes?: string; updated_at?: string }
interface EarnedMap { chase_ur: number; capital_one: number; marriott_bonvoy: number; txnCount?: number }

export default function PointsTrackerPage() {
  const [storedBalances, setStoredBalances] = useState<StoredBalance[]>([]);
  const [earned, setEarned] = useState<EarnedMap>({ chase_ur: 0, capital_one: 0, marriott_bonvoy: 0 });
  const [txnCount, setTxnCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingProgram, setEditingProgram] = useState<PointsBalanceFull | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, earnRes] = await Promise.all([
        fetch("/api/points-balances").then((r) => r.json()),
        fetch("/api/points-balances?earned=1").then((r) => r.json()),
      ]);
      setStoredBalances(balRes.balances ?? []);
      setEarned(earnRes.earned ?? {});
      setTxnCount(earnRes.txnCount ?? 0);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getBalance(programId: string): number {
    const stored = storedBalances.find((b) => b.program === programId);
    if (stored) return stored.balance;
    // Fall back to static seed
    const seed = POINTS_FULL.find((p) => p.program === programId);
    return seed?.balance ?? 0;
  }

  function getEarned(programId: string): number {
    const map: Record<string, keyof EarnedMap> = {
      chase_ur: "chase_ur", capital_one: "capital_one", marriott_bonvoy: "marriott_bonvoy",
    };
    const key = map[programId];
    return key ? (earned[key] ?? 0) : 0;
  }

  const totalValue = POINTS_FULL.reduce((s, p) => s + (getBalance(p.program) * p.cpp) / 100, 0);
  const totalEarnedValue = POINTS_FULL.reduce((s, p) => s + (getEarned(p.program) * p.cpp) / 100, 0);

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader
        title="Points Tracker"
        backHref="/strategy"
        subtitle="Balances, earned & validation"
      />

      <div className="flex flex-col gap-4 px-4">

        {/* Summary tile */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Points Value</p>
            <button onClick={load} disabled={loading}
              className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <RefreshCw size={12} className={`text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="text-3xl font-bold text-foreground">${fmt(Math.round(totalValue))}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across all programs at conservative CPP
          </p>
          {txnCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/70 px-3 py-2">
              <Zap size={12} className="text-primary shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Calculated from <span className="font-semibold text-foreground">{txnCount} transactions</span> in last 90 days ·
                {" "}<span className="font-semibold text-foreground">${Math.round(totalEarnedValue)} earned</span>
              </p>
            </div>
          )}
        </div>

        {/* CPP reference */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Value Reference (CPP)</p>
          <div className="grid grid-cols-3 gap-2">
            {POINTS_FULL.map((p) => (
              <div key={p.id} className="text-center">
                <div className="w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center"
                  style={{ backgroundColor: p.color + "20" }}>
                  <DollarSign size={12} style={{ color: p.color }} />
                </div>
                <p className="text-xs font-bold text-foreground">{p.cpp}¢</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{p.card}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Program rows */}
        <div className="flex flex-col gap-3">
          {POINTS_FULL.map((program) => (
            <ProgramRow
              key={program.id}
              program={program}
              manualBalance={getBalance(program.program)}
              earnedPts={getEarned(program.program)}
              onEdit={() => setEditingProgram(program)}
            />
          ))}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">How This Works</p>
          <div className="flex flex-col gap-2">
            {[
              ["Manual balance", "Tap the edit icon on any program and enter the balance directly from your card app. This is your ground truth."],
              ["Auto-calculated", "We estimate points earned by applying each card's multiplier to your Plaid transactions from the last 90 days."],
              ["Validation", "Compare the two: large gaps reveal uncounted spend (bonuses, portal purchases) or manual entry drift."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2.5">
                <CheckCircle size={13} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pb-2">
          Automatic integration with Chase/Cap1 apps isn't available — manual updates keep your tracker accurate.
        </p>
      </div>

      {editingProgram && (
        <EditBalanceModal
          program={editingProgram}
          current={getBalance(editingProgram.program)}
          onSave={(newVal) => {
            setStoredBalances((prev) => {
              const existing = prev.find((b) => b.program === editingProgram.program);
              if (existing) return prev.map((b) => b.program === editingProgram.program ? { ...b, balance: newVal } : b);
              return [...prev, { program: editingProgram.program, balance: newVal }];
            });
            setEditingProgram(null);
          }}
          onClose={() => setEditingProgram(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
