"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, Info, AlertTriangle } from "lucide-react";
import type { AccountWithHoldings, HoldingWithPrice } from "@/app/api/accounts/holdings-with-prices/route";
import {
  FUND_DATA,
  normalizeAssetClass,
  ASSET_CLASS_LABELS,
  ASSET_CLASS_COLORS,
  type AssetClass,
} from "@/lib/fund-data";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let offsetPct = 0;
  const slices = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    // rotate so slices go clockwise from top
    const rotation = offsetPct * 360 - 90;
    offsetPct += pct;
    return { ...seg, dash, gap, rotation };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className="shrink-0"
    >
      {slices.map((s) => (
        <circle
          key={s.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth="14"
          strokeDasharray={`${s.dash} ${s.gap}`}
          transform={`rotate(${s.rotation} ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      {/* center hole bg */}
      <circle cx={cx} cy={cy} r="28" fill="var(--card)" />
    </svg>
  );
}

// ── Bar row ───────────────────────────────────────────────────────────────────

function AllocBar({
  label,
  pctVal,
  color,
  sublabel,
  value,
}: {
  label: string;
  pctVal: number;
  color: string;
  sublabel?: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-xs font-medium text-foreground">{label}</span>
            {sublabel && <span className="text-[10px] text-muted-foreground ml-1.5">{sublabel}</span>}
          </div>
          <div className="text-right ml-2 shrink-0">
            <span className="text-xs font-bold text-foreground">{pct(pctVal)}</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">${fmt(value)}</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(pctVal, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Types for enriched holdings ───────────────────────────────────────────────

interface EnrichedHolding extends HoldingWithPrice {
  accountId: string;
  accountName: string;
  accountType: string;
  accountSource: "plaid" | "manual";
  value: number;         // best available value
  assetClass: AssetClass;
  geographic: string;
  category: string;
  expenseRatio: number | undefined;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<AccountWithHoldings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts/holdings-with-prices")
      .then((r) => r.json())
      .then((d) => {
        if (d.accounts) setAccounts(d.accounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Flatten all holdings with account context, enriched with fund data
  const holdings = useMemo<EnrichedHolding[]>(() => {
    const result: EnrichedHolding[] = [];
    for (const acct of accounts) {
      for (const h of acct.holdings) {
        const ticker = h.ticker?.toUpperCase() ?? null;
        const fundInfo = ticker ? FUND_DATA[ticker] : undefined;
        const assetClass: AssetClass =
          fundInfo?.assetClass ?? normalizeAssetClass(h.asset_class);
        const value = h.liveValue ?? 0;
        if (value <= 0) continue;

        result.push({
          ...h,
          accountId: acct.id,
          accountName: acct.name,
          accountType: acct.account_type,
          accountSource: acct.source,
          value,
          assetClass,
          geographic: fundInfo?.geographic ?? "other",
          category: fundInfo?.category ?? assetClass,
          expenseRatio: fundInfo?.expenseRatio,
        });
      }

      // If account has no priced holdings but has a balance, add an "unknown" entry
      if (acct.holdings.length === 0 && (acct.liveValue ?? acct.balance) > 0) {
        result.push({
          id: `${acct.id}-unknown`,
          ticker: null,
          name: acct.name,
          shares: 1,
          asset_class: null,
          cost_basis_per_share: null,
          livePrice: null,
          liveValue: acct.liveValue ?? acct.balance,
          costBasis: null,
          gainLoss: null,
          gainLossPct: null,
          accountId: acct.id,
          accountName: acct.name,
          accountType: acct.account_type,
          accountSource: acct.source,
          value: acct.liveValue ?? acct.balance,
          assetClass: "other",
          geographic: "other",
          category: "Unknown",
          expenseRatio: undefined,
        });
      }
    }
    return result;
  }, [accounts]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings]);
  const totalCostBasis = useMemo(() => holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0), [holdings]);
  const totalGainLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : null;

  // Asset class allocation
  const assetAllocation = useMemo(() => {
    const map = new Map<AssetClass, number>();
    for (const h of holdings) {
      map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + h.value);
    }
    return [...map.entries()]
      .map(([ac, val]) => ({ label: ASSET_CLASS_LABELS[ac], assetClass: ac, value: val, color: ASSET_CLASS_COLORS[ac], pct: totalValue > 0 ? (val / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // Account type breakdown
  const accountTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      map.set(h.accountType, (map.get(h.accountType) ?? 0) + h.value);
    }
    const ACCOUNT_COLORS: Record<string, string> = {
      "401k": "#117ACA",
      "hsa": "#22C55E",
      "roth": "#8B5CF6",
      "ira": "#F59E0B",
      "brokerage": "#64748B",
      "investment": "#F5A623",
      "other": "#94A3B8",
    };
    return [...map.entries()]
      .map(([type, val]) => ({
        label: type.toUpperCase(),
        value: val,
        color: ACCOUNT_COLORS[type.toLowerCase()] ?? ACCOUNT_COLORS.other,
        pct: totalValue > 0 ? (val / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // Geographic breakdown
  const geoBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      map.set(h.geographic, (map.get(h.geographic) ?? 0) + h.value);
    }
    const GEO_LABELS: Record<string, string> = { us: "United States", international: "International", global: "Global", other: "Other/Unknown" };
    const GEO_COLORS: Record<string, string> = { us: "#117ACA", international: "#22C55E", global: "#F5A623", other: "#94A3B8" };
    return [...map.entries()]
      .map(([geo, val]) => ({
        label: GEO_LABELS[geo] ?? geo,
        value: val,
        color: GEO_COLORS[geo] ?? "#94A3B8",
        pct: totalValue > 0 ? (val / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // Top 10 holdings by value
  const topHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.value - a.value).slice(0, 10),
    [holdings]
  );

  // Weighted average expense ratio (only for holdings where we know it)
  const { weightedER, coveredValue } = useMemo(() => {
    let weightedSum = 0;
    let covered = 0;
    for (const h of holdings) {
      if (h.expenseRatio !== undefined && h.value > 0) {
        weightedSum += h.expenseRatio * h.value;
        covered += h.value;
      }
    }
    return {
      weightedER: covered > 0 ? weightedSum / covered : null,
      coveredValue: covered,
    };
  }, [holdings]);

  const annualFeeDrag = weightedER !== null ? (weightedER / 100) * totalValue : null;

  // Concentration risk: % in top 3 positions
  const top3Pct = totalValue > 0
    ? topHoldings.slice(0, 3).reduce((s, h) => s + h.value, 0) / totalValue * 100
    : 0;
  const concentrationRisk = top3Pct > 50 ? "High" : top3Pct > 30 ? "Moderate" : "Low";
  const concentrationColor = top3Pct > 50 ? "text-destructive" : top3Pct > 30 ? "text-warning" : "text-success";

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen px-4 pt-6 pb-24 max-w-lg mx-auto animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-muted mb-4" />
        <div className="h-40 rounded-2xl bg-muted mb-3" />
        <div className="h-56 rounded-2xl bg-muted mb-3" />
        <div className="h-40 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col min-h-screen max-w-lg mx-auto">
        <div className="flex items-center gap-2 px-4 pt-6 pb-4">
          <Link href="/dashboard" className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft size={20} className="text-muted-foreground" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Portfolio Analysis</h1>
        </div>
        <div className="px-4">
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No investment holdings yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Link your 401k, HSA, or brokerage in{" "}
                <span className="text-primary font-medium">Settings → Connected Accounts</span>.
              </p>
            </div>
            <Link
              href="/settings/accounts"
              className="mt-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
            >
              Connect Investment Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-6 pb-4">
        <Link href="/dashboard" className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft size={20} className="text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Portfolio Analysis</h1>
          <p className="text-xs text-muted-foreground">{holdings.length} positions · {accounts.length} accounts</p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* ── Summary hero ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Portfolio Value</p>
          <p className="text-3xl font-bold text-foreground">${fmt(totalValue)}</p>
          {totalGainLoss !== null && (
            <div className={`flex items-center gap-1.5 mt-1 ${totalGainLoss >= 0 ? "text-success" : "text-destructive"}`}>
              {totalGainLoss >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="text-sm font-semibold">
                {totalGainLoss >= 0 ? "+" : ""}${fmt(Math.abs(totalGainLoss))} ({totalCostBasis > 0 ? ((totalGainLoss / totalCostBasis) * 100).toFixed(1) : "0.0"}%)
              </span>
              <span className="text-xs text-muted-foreground">unrealized</span>
            </div>
          )}
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Accounts</p>
              <p className="text-sm font-bold text-foreground">{accounts.length}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-[10px] text-muted-foreground">Positions</p>
              <p className="text-sm font-bold text-foreground">{holdings.filter(h => h.ticker).length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Concentration</p>
              <p className={`text-sm font-bold ${concentrationColor}`}>{concentrationRisk}</p>
            </div>
          </div>
        </div>

        {/* ── Asset Allocation ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Asset Allocation</p>
          <div className="flex items-center gap-4">
            <DonutChart
              segments={assetAllocation.map((a) => ({ label: a.label, value: a.value, color: a.color }))}
              size={140}
            />
            <div className="flex-1 flex flex-col gap-2.5">
              {assetAllocation.map((a) => (
                <div key={a.assetClass} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-xs text-foreground truncate">{a.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-foreground">{pct(a.pct)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Bars */}
          <div className="mt-4 pt-3 border-t border-border flex flex-col gap-3">
            {assetAllocation.map((a) => (
              <AllocBar
                key={a.assetClass}
                label={a.label}
                pctVal={a.pct}
                color={a.color}
                value={a.value}
              />
            ))}
          </div>
        </div>

        {/* ── Account Type Breakdown ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Account Type Breakdown</p>
          <div className="flex items-center gap-4 mb-4">
            <DonutChart
              segments={accountTypeBreakdown.map((a) => ({ label: a.label, value: a.value, color: a.color }))}
              size={140}
            />
            <div className="flex-1 flex flex-col gap-2.5">
              {accountTypeBreakdown.map((a) => (
                <div key={a.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-xs text-foreground truncate">{a.label}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground shrink-0">{pct(a.pct)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {accountTypeBreakdown.map((a) => (
              <AllocBar key={a.label} label={a.label} pctVal={a.pct} color={a.color} value={a.value} />
            ))}
          </div>
        </div>

        {/* ── Geographic Exposure ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Geographic Exposure</p>
            {geoBreakdown.some(g => g.label === "Other/Unknown") && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Info size={10} />
                Some funds unclassified
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {geoBreakdown.map((g) => (
              <AllocBar key={g.label} label={g.label} pctVal={g.pct} color={g.color} value={g.value} />
            ))}
          </div>
        </div>

        {/* ── Top 10 Holdings ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Holdings</p>
            {top3Pct > 50 && (
              <div className="flex items-center gap-1.5 mt-1.5 text-warning">
                <AlertTriangle size={11} />
                <span className="text-[10px] font-medium">Top 3 positions = {pct(top3Pct)} — consider diversifying</span>
              </div>
            )}
          </div>
          <div className="divide-y divide-border/60">
            {topHoldings.map((h, i) => {
              const portPct = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
              return (
                <div key={h.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {h.ticker ?? h.name}
                      </p>
                      {h.ticker && h.name !== h.ticker && (
                        <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{h.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{h.accountName}</span>
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded-full uppercase"
                        style={{
                          backgroundColor: `${ASSET_CLASS_COLORS[h.assetClass]}20`,
                          color: ASSET_CLASS_COLORS[h.assetClass],
                        }}
                      >
                        {ASSET_CLASS_LABELS[h.assetClass]}
                      </span>
                    </div>
                    {/* mini bar */}
                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(portPct * 3, 100)}%`,
                          backgroundColor: ASSET_CLASS_COLORS[h.assetClass],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground">${fmt(h.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{pct(portPct)}</p>
                    {h.gainLoss !== null && (
                      <p className={`text-[10px] font-medium ${h.gainLoss >= 0 ? "text-success" : "text-destructive"}`}>
                        {h.gainLoss >= 0 ? "+" : ""}${fmt(Math.abs(h.gainLoss))}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Fee Analysis ────────────────────────────────────────────────────── */}
        {weightedER !== null && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Expense Ratio & Fee Drag</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-foreground">{weightedER.toFixed(3)}%</p>
                <p className="text-xs text-muted-foreground">weighted avg expense ratio</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-destructive">−${fmt(annualFeeDrag ?? 0)}/yr</p>
                <p className="text-xs text-muted-foreground">estimated annual fee drag</p>
              </div>
            </div>
            {coveredValue < totalValue && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info size={10} />
                Based on ${fmt(coveredValue)} ({pct((coveredValue / totalValue) * 100)}) of portfolio with known expense ratios
              </p>
            )}
            {/* Benchmark */}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Your weighted ER</span>
                <span className={`font-semibold ${weightedER < 0.1 ? "text-success" : weightedER < 0.3 ? "text-warning" : "text-destructive"}`}>
                  {weightedER.toFixed(3)}%
                  {weightedER < 0.1 ? " — Excellent" : weightedER < 0.3 ? " — Good" : " — High"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Index fund benchmark</span>
                <span className="font-semibold text-muted-foreground">~0.03%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Industry average</span>
                <span className="font-semibold text-muted-foreground">~0.40%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── All Positions ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Positions</p>
          </div>
          <div className="divide-y divide-border/60">
            {[...holdings].sort((a, b) => b.value - a.value).map((h) => {
              const portPct = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
              const fundInfo = h.ticker ? FUND_DATA[h.ticker] : undefined;
              return (
                <div key={h.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground">{h.ticker ?? "—"}</p>
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded-full uppercase"
                        style={{
                          backgroundColor: `${ASSET_CLASS_COLORS[h.assetClass]}20`,
                          color: ASSET_CLASS_COLORS[h.assetClass],
                        }}
                      >
                        {ASSET_CLASS_LABELS[h.assetClass]}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {fundInfo?.name ?? h.name} · {h.accountName}
                    </p>
                    {fundInfo?.expenseRatio !== undefined && (
                      <p className="text-[10px] text-muted-foreground">ER: {fundInfo.expenseRatio.toFixed(3)}%</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground">${fmt(h.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{pct(portPct)}</p>
                    {h.gainLoss !== null && (
                      <p className={`text-[10px] font-medium ${h.gainLoss >= 0 ? "text-success" : "text-destructive"}`}>
                        {h.gainLoss >= 0 ? "+" : ""}${fmt(Math.abs(h.gainLoss))} ({h.gainLossPct !== null ? (h.gainLoss >= 0 ? "+" : "") + h.gainLossPct.toFixed(1) + "%" : ""})
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
