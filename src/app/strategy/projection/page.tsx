"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Target, Sparkles } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${fmt(n)}`;
}

// Monthly projection accounting for salary growth and annual bonuses
function buildProjection(
  pv: number,
  monthlyReturn: number,
  baseMonthlySavings: number,
  annualSalaryGrowthPct: number,
  annualBonusAmount: number,
  months: number
): number[] {
  const pts: number[] = [pv];
  let nw = pv;
  const growthPerYear = annualSalaryGrowthPct / 100;
  for (let m = 1; m <= months; m++) {
    const year = Math.floor((m - 1) / 12);
    const savingsThisMonth = baseMonthlySavings * Math.pow(1 + growthPerYear, year);
    const bonusThisMonth = m % 12 === 0 ? annualBonusAmount : 0;
    nw = nw * (1 + monthlyReturn) + savingsThisMonth + bonusThisMonth;
    pts.push(nw);
  }
  return pts;
}

function monthsToTarget(
  pv: number, monthlyReturn: number, baseMonthlySavings: number,
  salaryGrowthPct: number, bonusAmount: number, target: number
): number | null {
  if (pv >= target) return 0;
  const pts = buildProjection(pv, monthlyReturn, baseMonthlySavings, salaryGrowthPct, bonusAmount, 600);
  const idx = pts.findIndex((v) => v >= target);
  return idx === -1 ? null : idx;
}

function addMonthsToNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── SVG chart ────────────────────────────────────────────────────────────────

function ProjectionChart({ points, milestones, startNW }: {
  points: number[];
  milestones: number[];
  startNW: number;
}) {
  const W = 340; const H = 160; const MONTHS = points.length - 1;
  const pad = { t: 12, r: 10, b: 28, l: 52 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const maxVal = Math.max(...points, startNW * 1.1);

  const px = (i: number) => pad.l + (i / MONTHS) * w;
  const py = (v: number) => pad.t + h - Math.max(0, Math.min(1, v / maxVal)) * h;

  const pathD = points.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${px(MONTHS).toFixed(1)} ${(pad.t + h).toFixed(1)} L ${pad.l} ${(pad.t + h).toFixed(1)} Z`;

  // Deduplicate milestone labels — skip any that would overlap (< 14px apart in Y)
  const visibleMilestones: number[] = [];
  const usedY: number[] = [];
  for (const m of [...milestones].sort((a, b) => a - b)) {
    if (m <= startNW || m > maxVal * 1.02) continue;
    const y = py(m);
    if (usedY.every((u) => Math.abs(u - y) >= 14)) {
      visibleMilestones.push(m);
      usedY.push(y);
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#projGrad)" />
      {visibleMilestones.map((m) => (
        <g key={m}>
          <line x1={pad.l} y1={py(m)} x2={W - pad.r} y2={py(m)}
            stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 3" className="text-border" />
          <text x={pad.l - 4} y={py(m) + 3.5} fontSize="7.5" textAnchor="end" className="fill-muted-foreground">
            {fmtK(m)}
          </text>
        </g>
      ))}
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(0)} cy={py(points[0])} r="3" fill="hsl(var(--primary))" />
      <circle cx={px(MONTHS)} cy={py(points[MONTHS])} r="3.5" fill="hsl(var(--primary))" />
      {[0, 24, 48, 72, 96, 120].map((i) => i <= MONTHS && (
        <text key={i} x={px(i)} y={H - 5} fontSize="7.5" textAnchor="middle" className="fill-muted-foreground">
          {i === 0 ? "Now" : `Yr ${i / 12}`}
        </text>
      ))}
    </svg>
  );
}

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({ target, currentNW, months }: { target: number; currentNW: number; months: number | null }) {
  const reached = currentNW >= target;
  return (
    <div className={`rounded-2xl border p-3.5 flex items-center justify-between gap-2 ${
      reached ? "border-success/30 bg-success/5" : months === null ? "border-border bg-muted/30" : "border-border bg-card"
    }`}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{fmtK(target)}</p>
        {reached ? (
          <p className="text-[11px] text-success font-medium">Already reached ✓</p>
        ) : months === null ? (
          <p className="text-[11px] text-muted-foreground">Increase savings rate to reach this</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {addMonthsToNow(months)} · {months < 12 ? `${months}mo` : `${(months / 12).toFixed(1)} yrs`}
          </p>
        )}
      </div>
      {reached ? <span className="text-xl shrink-0">✅</span> : (
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
          <Target size={14} className="text-primary" />
        </div>
      )}
    </div>
  );
}

// ─── Input row ────────────────────────────────────────────────────────────────

function InputRow({ label, sublabel, value, prefix, suffix, onChange }: {
  label: string; sublabel?: string; value: number;
  prefix?: string; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sublabel}</p>}
      </div>
      <div className="relative flex items-center shrink-0">
        {prefix && <span className="absolute left-2.5 text-sm text-muted-foreground pointer-events-none select-none">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`w-24 rounded-xl border border-border bg-background text-sm font-bold text-foreground text-right py-1.5 pr-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 ${prefix ? "pl-6" : "pl-2.5"}`}
        />
        {suffix && <span className="ml-1.5 text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MILESTONES = [75_000, 100_000, 150_000, 200_000, 250_000, 500_000, 1_000_000];

export default function ProjectionPage() {
  const [sheetsNW, setSheetsNW]           = useState<number | null>(null);
  const [avgSuggestion, setAvgSuggestion] = useState<number | null>(null);
  const [avgSavingsRate, setAvgSavingsRate] = useState<number | null>(null);

  const [monthlySavings, setMonthlySavings] = useState(1500);
  const [annualReturn,   setAnnualReturn]   = useState(7);
  const [salaryGrowth,   setSalaryGrowth]   = useState(4);
  const [annualBonus,    setAnnualBonus]    = useState(0);

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => r.json())
      .then(({ data }) => {
        const months: { income: number; savings: number; netWorth: number }[] = data?.allMonths ?? [];
        if (!months.length) return;

        const latest = months[months.length - 1];
        if (latest.netWorth > 0) setSheetsNW(latest.netWorth);

        // Last 6 months with income to compute avg savings
        const recent = months.filter((m) => m.income > 0).slice(-6);
        if (recent.length > 0) {
          const avgSav = recent.reduce((s, m) => s + m.savings, 0) / recent.length;
          const avgInc = recent.reduce((s, m) => s + m.income, 0) / recent.length;
          const pct = avgInc > 0 ? Math.round((avgSav / avgInc) * 100) : 0;
          const suggested = Math.max(0, Math.round(avgSav / 50) * 50);
          setAvgSuggestion(suggested);
          setAvgSavingsRate(pct);
          setMonthlySavings(suggested || 1500);
        }
      })
      .catch(() => {});
  }, []);

  const nw = sheetsNW ?? 0;
  const r  = annualReturn / 100 / 12;
  const projectionPoints = buildProjection(nw, r, monthlySavings, salaryGrowth, annualBonus, 120);
  const finalNW = projectionPoints[120];

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader title="NW Projection" backHref="/dashboard" subtitle="Where you&apos;ll be in 10 years" />

      <div className="flex flex-col gap-4 px-4">

        {/* Starting point */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Starting Point</p>
          {sheetsNW === null
            ? <div className="h-8 w-32 rounded-lg bg-muted animate-pulse mt-2" />
            : <p className="text-3xl font-bold text-foreground mt-1">${fmt(nw)}</p>
          }
          <p className="text-[11px] text-muted-foreground mt-1">
            From Google Sheets — your comprehensive net worth
          </p>
        </div>

        {/* Assumptions */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assumptions</p>
            {avgSuggestion !== null && (
              <button
                onClick={() => setMonthlySavings(avgSuggestion)}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
              >
                <Sparkles size={10} />
                Avg: ${fmt(avgSuggestion)}/mo{avgSavingsRate !== null ? ` (${avgSavingsRate}%)` : ""}
              </button>
            )}
          </div>
          <InputRow label="Monthly savings" sublabel="How much you save each month" value={monthlySavings} prefix="$" onChange={setMonthlySavings} />
          <InputRow label="Annual return" sublabel="7–10% is the historical S&P avg" value={annualReturn} suffix="%/yr" onChange={(v) => setAnnualReturn(Math.max(0, Math.min(20, v)))} />
          <InputRow label="Annual salary raises" sublabel="How much your income grows per year" value={salaryGrowth} suffix="%/yr" onChange={(v) => setSalaryGrowth(Math.max(0, Math.min(20, v)))} />
          <InputRow label="Annual bonus" sublabel="Added once per year (after taxes)" value={annualBonus} prefix="$" onChange={setAnnualBonus} />
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">10-Year Trajectory</p>
            </div>
            <p className="text-base font-bold text-primary">{fmtK(finalNW)}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            {annualReturn}% return · {salaryGrowth}%/yr raises{annualBonus > 0 ? ` · $${fmt(annualBonus)} bonus` : ""}
          </p>
          {nw > 0 ? (
            <ProjectionChart points={projectionPoints} milestones={MILESTONES} startNW={nw} />
          ) : (
            <div className="h-28 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Loading NW from Sheets…</p>
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Milestones</p>
          {MILESTONES.map((m) => (
            <MilestoneCard key={m} target={m} currentNW={nw}
              months={monthsToTarget(nw, r, monthlySavings, salaryGrowth, annualBonus, m)} />
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed pb-2">
          Projections assume consistent returns and savings. Actual results vary. Not financial advice.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
