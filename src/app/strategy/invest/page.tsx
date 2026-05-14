"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Edit2, Save } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollConfig {
  grossPay: number;
  netPay: number;
  k401: number;
  hsa: number;
  espp: number;
  dental: number;
  medical: number;
  vision: number;
  fedTax: number;
  ficaTax: number;
  stateTax: number;
  medicareTax: number;
}

interface AllocationTargets {
  k401Pct: number;   // % of gross
  hsaPct: number;
  esppPct: number;
  brokeragePct: number;
}

interface MonthlyInvestments {
  k401: number;
  hsa: number;
  espp: number;
  brokerage: number;
  other: number;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const DEFAULT_PAYROLL: PayrollConfig = {
  grossPay: 3904.17, netPay: 2109.03,
  k401: 741.79, hsa: 162.50, espp: 117.13,
  dental: 6.67, medical: 58.78, vision: 3.61,
  fedTax: 277.15, ficaTax: 227.78, stateTax: 145.14, medicareTax: 53.27,
};

const DEFAULT_TARGETS: AllocationTargets = {
  k401Pct: 19, hsaPct: 4, esppPct: 3, brokeragePct: 5,
};

function loadPayroll(): PayrollConfig {
  if (typeof window === "undefined") return DEFAULT_PAYROLL;
  try {
    const r = localStorage.getItem("payroll_config_v1");
    return r ? { ...DEFAULT_PAYROLL, ...JSON.parse(r) } : DEFAULT_PAYROLL;
  } catch { return DEFAULT_PAYROLL; }
}

function savePayroll(p: PayrollConfig) {
  localStorage.setItem("payroll_config_v1", JSON.stringify(p));
}

function loadTargets(): AllocationTargets {
  if (typeof window === "undefined") return DEFAULT_TARGETS;
  try {
    const r = localStorage.getItem("allocation_targets_v1");
    return r ? { ...DEFAULT_TARGETS, ...JSON.parse(r) } : DEFAULT_TARGETS;
  } catch { return DEFAULT_TARGETS; }
}

function saveTargets(t: AllocationTargets) {
  localStorage.setItem("allocation_targets_v1", JSON.stringify(t));
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadMonthlyInvestments(key: string): MonthlyInvestments {
  if (typeof window === "undefined") return { k401: 0, hsa: 0, espp: 0, brokerage: 0, other: 0 };
  try {
    const raw = localStorage.getItem("monthly_investments_v1");
    const all = raw ? JSON.parse(raw) : {};
    return all[key] ?? { k401: 0, hsa: 0, espp: 0, brokerage: 0, other: 0 };
  } catch { return { k401: 0, hsa: 0, espp: 0, brokerage: 0, other: 0 }; }
}

function saveMonthlyInvestments(key: string, data: MonthlyInvestments) {
  try {
    const raw = localStorage.getItem("monthly_investments_v1");
    const all = raw ? JSON.parse(raw) : {};
    all[key] = data;
    localStorage.setItem("monthly_investments_v1", JSON.stringify(all));
  } catch { /* ignore */ }
}

function loadYTD(): Record<string, MonthlyInvestments> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("monthly_investments_v1");
    if (!raw) return {};
    const all: Record<string, MonthlyInvestments> = JSON.parse(raw);
    const year = new Date().getFullYear().toString();
    const result: Record<string, MonthlyInvestments> = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(year)) result[k] = v;
    }
    return result;
  } catch { return {}; }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── NumberInput ─────────────────────────────────────────────────────────────

function NumberInput({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-muted-foreground flex-1">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">$</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

// ─── PctInput ─────────────────────────────────────────────────────────────────

function PctInput({
  label, value, monthly, onChange,
}: { label: string; value: number; monthly: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">${fmt(monthly)}/mo target</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

// ─── Allocation row ───────────────────────────────────────────────────────────

function AllocationRow({
  label, targetMonthly, actual,
}: { label: string; targetMonthly: number; actual: number }) {
  const onTrack = actual >= targetMonthly * 0.95;
  const pct = targetMonthly > 0 ? Math.min((actual / targetMonthly) * 100, 100) : 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {onTrack
            ? <CheckCircle2 size={12} className="text-success" />
            : <AlertTriangle size={12} className="text-warning" />}
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          ${fmt(actual)} <span className="text-muted-foreground/60">/ ${fmt(targetMonthly)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${onTrack ? "bg-success" : "bg-warning"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvestPage() {
  const [payroll, setPayroll] = useState<PayrollConfig>(DEFAULT_PAYROLL);
  const [targets, setTargets] = useState<AllocationTargets>(DEFAULT_TARGETS);
  const [monthly, setMonthly] = useState<MonthlyInvestments>({ k401: 0, hsa: 0, espp: 0, brokerage: 0, other: 0 });
  const [editing, setEditing] = useState(false);
  const [editPayroll, setEditPayroll] = useState<PayrollConfig>(DEFAULT_PAYROLL);
  const [showYTD, setShowYTD] = useState(false);
  const [ytd, setYtd] = useState<Record<string, MonthlyInvestments>>({});
  const key = monthKey();

  useEffect(() => {
    const p = loadPayroll();
    const t = loadTargets();
    const m = loadMonthlyInvestments(key);
    setPayroll(p);
    setEditPayroll(p);
    setTargets(t);
    // Pre-fill monthly with payroll auto-values if empty
    const autoK401 = p.k401 * 2;
    const autoHsa = p.hsa * 2;
    const autoEspp = p.espp * 2;
    setMonthly({
      k401: m.k401 || autoK401,
      hsa: m.hsa || autoHsa,
      espp: m.espp || autoEspp,
      brokerage: m.brokerage,
      other: m.other,
    });
    setYtd(loadYTD());
  }, [key]);

  function saveAll() {
    setPayroll(editPayroll);
    savePayroll(editPayroll);
    setEditing(false);
  }

  function updateMonthly(field: keyof MonthlyInvestments, val: number) {
    const next = { ...monthly, [field]: val };
    setMonthly(next);
    saveMonthlyInvestments(key, next);
  }

  function updateTarget(field: keyof AllocationTargets, val: number) {
    const next = { ...targets, [field]: val };
    setTargets(next);
    saveTargets(next);
  }

  // Derived values
  const autoSavings = payroll.k401 + payroll.hsa + payroll.espp;
  const autoSavingsRate = payroll.grossPay > 0 ? (autoSavings / payroll.grossPay) * 100 : 0;
  const preTaxDeductions = payroll.k401 + payroll.hsa + payroll.dental + payroll.medical + payroll.vision;
  const taxes = payroll.fedTax + payroll.ficaTax + payroll.stateTax + payroll.medicareTax;

  const grossMonthly = payroll.grossPay * 2; // 2 paychecks/month
  const targetK401 = (targets.k401Pct / 100) * grossMonthly;
  const targetHsa = (targets.hsaPct / 100) * grossMonthly;
  const targetEspp = (targets.esppPct / 100) * grossMonthly;
  const targetBrokerage = (targets.brokeragePct / 100) * grossMonthly;

  const totalMonthly = monthly.k401 + monthly.hsa + monthly.espp + monthly.brokerage + monthly.other;

  // YTD totals
  const ytdTotals = Object.values(ytd).reduce(
    (acc, m) => ({
      k401: acc.k401 + m.k401,
      hsa: acc.hsa + m.hsa,
      espp: acc.espp + m.espp,
      brokerage: acc.brokerage + m.brokerage,
      other: acc.other + m.other,
    }),
    { k401: 0, hsa: 0, espp: 0, brokerage: 0, other: 0 }
  );
  const ytdTotal = Object.values(ytdTotals).reduce((s, v) => s + v, 0);
  const k401Limit = 23500;
  const hsaLimit = 4300;

  // Actions
  const actions: string[] = [];
  if (monthly.brokerage < targetBrokerage) {
    actions.push(`Buy $${fmt(targetBrokerage - monthly.brokerage)} more in Fidelity to hit your ${targets.brokeragePct}% brokerage target`);
  }
  if (monthly.k401 >= targetK401 * 0.95) {
    actions.push("401k contributions on track ✅");
  }
  if (ytdTotals.k401 >= k401Limit * 0.9) {
    actions.push(`401k approaching IRS limit — $${fmt(k401Limit - ytdTotals.k401)} remaining for the year`);
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader
        title="Invest & Save"
        backHref="/dashboard"
        subtitle="Payroll, allocations & investment tracker"
      />

      <div className="flex flex-col gap-4 px-4">

        {/* ── Payroll snapshot ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paycheck Breakdown</p>
            <button
              onClick={() => editing ? saveAll() : setEditing(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              {editing ? <><Save size={12} /> Save</> : <><Edit2 size={12} /> Edit</>}
            </button>
          </div>

          {editing ? (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Earnings</p>
              <NumberInput label="Gross Pay" value={editPayroll.grossPay} onChange={(v) => setEditPayroll((p) => ({ ...p, grossPay: v }))} />
              <NumberInput label="Net Pay" value={editPayroll.netPay} onChange={(v) => setEditPayroll((p) => ({ ...p, netPay: v }))} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">Pre-Tax Deductions</p>
              <NumberInput label="401K" value={editPayroll.k401} onChange={(v) => setEditPayroll((p) => ({ ...p, k401: v }))} />
              <NumberInput label="HSA" value={editPayroll.hsa} onChange={(v) => setEditPayroll((p) => ({ ...p, hsa: v }))} />
              <NumberInput label="Dental" value={editPayroll.dental} onChange={(v) => setEditPayroll((p) => ({ ...p, dental: v }))} />
              <NumberInput label="Medical (HDHP)" value={editPayroll.medical} onChange={(v) => setEditPayroll((p) => ({ ...p, medical: v }))} />
              <NumberInput label="Vision" value={editPayroll.vision} onChange={(v) => setEditPayroll((p) => ({ ...p, vision: v }))} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">Taxes</p>
              <NumberInput label="Federal W/H" value={editPayroll.fedTax} onChange={(v) => setEditPayroll((p) => ({ ...p, fedTax: v }))} />
              <NumberInput label="FICA EE" value={editPayroll.ficaTax} onChange={(v) => setEditPayroll((p) => ({ ...p, ficaTax: v }))} />
              <NumberInput label="Medicare EE" value={editPayroll.medicareTax} onChange={(v) => setEditPayroll((p) => ({ ...p, medicareTax: v }))} />
              <NumberInput label="IL State W/H" value={editPayroll.stateTax} onChange={(v) => setEditPayroll((p) => ({ ...p, stateTax: v }))} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">Post-Tax</p>
              <NumberInput label="ESPP" value={editPayroll.espp} onChange={(v) => setEditPayroll((p) => ({ ...p, espp: v }))} />
            </div>
          ) : (
            <div className="px-4 pb-4 flex flex-col gap-1.5">
              {/* Waterfall */}
              {[
                { label: "Gross Pay", value: payroll.grossPay, type: "gross" as const },
                { label: "− Pre-tax deductions", value: -preTaxDeductions, type: "sub" as const },
                { label: "− Taxes", value: -taxes, type: "sub" as const },
                { label: "− Post-tax (ESPP)", value: -payroll.espp, type: "sub" as const },
                { label: "= Net Pay", value: payroll.netPay, type: "net" as const },
              ].map(({ label, value, type }) => (
                <div key={label} className={`flex justify-between items-center py-1 ${type === "net" ? "border-t border-border mt-1 pt-2" : ""}`}>
                  <span className={`text-xs ${type === "gross" || type === "net" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`text-xs font-semibold tabular-nums ${type === "sub" ? "text-destructive" : type === "net" ? "text-success" : "text-foreground"}`}>
                    {value < 0 ? "-" : ""}${fmt(Math.abs(value), 2)}
                  </span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Auto-saved this paycheck</p>
                  <p className="text-xs font-bold text-success">${fmt(autoSavings, 2)} ({autoSavingsRate.toFixed(1)}% of gross)</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">401k + HSA + ESPP</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Monthly tracker ── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              This Month — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <span className="text-xs font-bold text-foreground">${fmt(totalMonthly)} total</span>
          </div>
          <div className="flex flex-col gap-3">
            {(
              [
                { field: "k401" as const, label: "401k" },
                { field: "hsa" as const, label: "HSA" },
                { field: "espp" as const, label: "ESPP" },
                { field: "brokerage" as const, label: "Fidelity Brokerage" },
                { field: "other" as const, label: "Other Savings" },
              ]
            ).map(({ field, label }) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground flex-1">{label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="1"
                    value={monthly[field]}
                    onChange={(e) => updateMonthly(field, Number(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Target allocations ── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Target Allocations (% of gross)</p>
          <div className="flex flex-col gap-3 mb-4">
            <PctInput label="401k" value={targets.k401Pct} monthly={targetK401} onChange={(v) => updateTarget("k401Pct", v)} />
            <PctInput label="HSA" value={targets.hsaPct} monthly={targetHsa} onChange={(v) => updateTarget("hsaPct", v)} />
            <PctInput label="ESPP" value={targets.esppPct} monthly={targetEspp} onChange={(v) => updateTarget("esppPct", v)} />
            <PctInput label="Taxable Brokerage" value={targets.brokeragePct} monthly={targetBrokerage} onChange={(v) => updateTarget("brokeragePct", v)} />
          </div>
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">On Track This Month</p>
            <div className="flex flex-col gap-3">
              <AllocationRow label="401k" targetMonthly={targetK401} actual={monthly.k401} />
              <AllocationRow label="HSA" targetMonthly={targetHsa} actual={monthly.hsa} />
              <AllocationRow label="ESPP" targetMonthly={targetEspp} actual={monthly.espp} />
              <AllocationRow label="Brokerage" targetMonthly={targetBrokerage} actual={monthly.brokerage} />
            </div>
          </div>
        </div>

        {/* ── Action panel ── */}
        {actions.length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-accent p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Action Items</p>
            <div className="flex flex-col gap-2">
              {actions.map((a, i) => (
                <p key={i} className="text-xs text-foreground leading-relaxed flex gap-1.5">
                  <span className="text-primary mt-0.5 shrink-0">·</span>
                  <span>{a}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── YTD Summary ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowYTD((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Year-to-Date {new Date().getFullYear()}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">${fmt(ytdTotal)}</span>
              {showYTD ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </div>
          </button>

          {showYTD && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border">
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { label: "401k", actual: ytdTotals.k401, limit: k401Limit },
                  { label: "HSA", actual: ytdTotals.hsa, limit: hsaLimit },
                  { label: "ESPP", actual: ytdTotals.espp, limit: null },
                  { label: "Brokerage", actual: ytdTotals.brokerage, limit: null },
                  { label: "Other", actual: ytdTotals.other, limit: null },
                ].map(({ label, actual, limit }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-foreground">{label}</span>
                      <span className="text-xs text-foreground">
                        ${fmt(actual)}
                        {limit && <span className="text-muted-foreground"> / ${fmt(limit)} limit</span>}
                      </span>
                    </div>
                    {limit && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${actual / limit >= 0.9 ? "bg-warning" : "bg-primary"}`}
                          style={{ width: `${Math.min((actual / limit) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
