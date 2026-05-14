"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Award,
  BarChart2,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  Flame,
  TrendingUp,
  Coins,
  AlertTriangle,
  PieChart,
  Sparkles,
  Info,
  Check,
  X,
  Loader2,
  BellRing,
} from "lucide-react";
import {
  POINTS_PROGRAMS,
  CARD_FEE_ANALYSIS,
  CARDS_TO_CONSIDER,
  STRATEGY_ALERTS,
  type PointsProgram,
  type CardAnnualFeeData,
  type CardToConsider,
  type StrategyAlert,
} from "@/lib/strategy-data";
import { clearAlertBadge } from "@/components/bottom-nav";

// ─── Live alert types ─────────────────────────────────────────────────────────

interface LiveAlert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low" | "info";
  title: string;
  body: string | null;
  due_at: string | null;
  created_at: string;
}

type Tab = "programs" | "fees" | "consider" | "alerts";

const TABS: { id: Tab; label: string }[] = [
  { id: "programs", label: "Programs" },
  { id: "fees", label: "Annual Fees" },
  { id: "consider", label: "Consider" },
  { id: "alerts", label: "Alerts" },
];

export default function StrategyPage() {
  const [tab, setTab] = useState<Tab>("programs");
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsLoaded, setAlertsLoaded] = useState(false);

  // Lazy-load live alerts only when the user opens the Alerts tab
  useEffect(() => {
    if (tab !== "alerts" || alertsLoaded) return;
    setAlertsLoading(true);
    clearAlertBadge(); // clear the nav badge once the user sees the tab
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(({ alerts }) => {
        setLiveAlerts(alerts ?? []);
        setAlertsLoaded(true);
      })
      .catch(() => setAlertsLoaded(true))
      .finally(() => setAlertsLoading(false));
  }, [tab, alertsLoaded]);

  async function dismissAlert(id: string) {
    setLiveAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function dismissAll() {
    setLiveAlerts([]);
    await fetch("/api/alerts?id=all", { method: "DELETE" });
  }

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Cards</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Optimizer, strategy & rewards intel</p>
      </div>

      {/* Optimizer quick-access */}
      <div className="px-4 mb-3">
        <Link
          href="/optimizer"
          className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3.5 shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-white">Daily Card Optimizer</p>
            <p className="text-xs text-white/75 mt-0.5">Which card to use right now</p>
          </div>
          <ChevronRight size={18} className="text-white/80 shrink-0" />
        </Link>
      </div>

      {/* Sub-page tiles */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-4">
        <SubpageTile
          href="/strategy/calendar"
          icon={<Calendar size={18} className="text-primary" />}
          label="Fee Calendar"
        />
        <SubpageTile
          href="/strategy/burn"
          icon={<Flame size={18} className="text-primary" />}
          label="Burn Tracker"
        />
        <SubpageTile
          href="/strategy/benefits"
          icon={<Award size={18} className="text-primary" />}
          label="Card Benefits"
        />
        <SubpageTile
          href="/strategy/payment-timing"
          icon={<Clock size={18} className="text-primary" />}
          label="Payment Timing"
        />
        <SubpageTile
          href="/strategy/downgrade/boundless"
          icon={<ArrowRightLeft size={18} className="text-primary" />}
          label="Downgrade"
        />
        <SubpageTile
          href="/strategy/credit"
          icon={<TrendingUp size={18} className="text-primary" />}
          label="Credit Score"
        />
        <SubpageTile
          href="/strategy/compare"
          icon={<BarChart2 size={18} className="text-primary" />}
          label="Compare Cards"
        />
        <SubpageTile
          href="/strategy/points"
          icon={<Coins size={18} className="text-primary" />}
          label="Points Tracker"
        />
      </div>

      {/* Deals & Offers featured strip */}
      <div className="px-4 mb-4">
        <Link
          href="/strategy/deals"
          className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Deals & Offers</p>
              <p className="text-[11px] text-muted-foreground">Transfer bonuses, SUBs & sweet spots — scored for you</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">3 HOT</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((t) => {
            const isAlerts = t.id === "alerts";
            const alertBadge = isAlerts && liveAlerts.length > 0 && tab !== "alerts";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  tab === t.id
                    ? "bg-primary text-white"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
                {alertBadge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] font-bold text-white flex items-center justify-center">
                    {liveAlerts.length > 9 ? "9+" : liveAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 flex flex-col gap-3">
        {tab === "programs" && (
          <>
            {POINTS_PROGRAMS.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </>
        )}
        {tab === "fees" && (
          <>
            {CARD_FEE_ANALYSIS.map((c) => (
              <FeeAnalysisCard key={c.id} card={c} />
            ))}
          </>
        )}
        {tab === "consider" && (
          <>
            {CARDS_TO_CONSIDER.map((c) => (
              <ConsiderCard key={c.name} card={c} />
            ))}
          </>
        )}
        {tab === "alerts" && (
          <>
            {/* ── Live alerts from cron ── */}
            {alertsLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            )}

            {!alertsLoading && liveAlerts.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing size={14} className="text-primary" />
                    <p className="text-xs font-semibold text-foreground">Live Alerts</p>
                    <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                      {liveAlerts.length}
                    </span>
                  </div>
                  <button
                    onClick={dismissAll}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss all
                  </button>
                </div>
                {liveAlerts.map((a) => (
                  <LiveAlertCard key={a.id} alert={a} onDismiss={dismissAlert} />
                ))}
                <div className="h-px bg-border my-1" />
              </>
            )}

            {!alertsLoading && liveAlerts.length === 0 && alertsLoaded && (
              <div className="rounded-2xl border border-border bg-card px-4 py-5 flex items-center gap-3">
                <Check size={16} className="text-success shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">All clear</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No active alerts right now. Cron runs daily at 7 AM ET.</p>
                </div>
              </div>
            )}

            {/* ── Static strategy notes ── */}
            {liveAlerts.length > 0 && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-1">
                Strategy Notes
              </p>
            )}
            {STRATEGY_ALERTS.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-page tile (link out to sub-features) ────────────────────────────────

function SubpageTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card px-3 py-3 flex flex-col items-center justify-center gap-1.5 hover:bg-muted transition-colors"
    >
      <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">{icon}</div>
      <span className="text-[11px] font-medium text-foreground text-center leading-tight">{label}</span>
    </Link>
  );
}

// ─── Program Card (transfer partners + CPP) ──────────────────────────────────

function ProgramCard({ program }: { program: PointsProgram }) {
  const [expanded, setExpanded] = useState(false);
  const activeBonusCount = program.partners.filter((p) => p.bonusActive).length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: program.color, color: program.textColor }}
        >
          {program.shortName.split(" ")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{program.name}</p>
          <p className="text-xs text-muted-foreground">
            {program.cpp}¢/pt transfer · {program.cpp_portal}¢/pt portal
          </p>
        </div>
        {activeBonusCount > 0 && (
          <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full whitespace-nowrap">
            {activeBonusCount} bonus
          </span>
        )}
      </div>

      {/* Notes */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {program.notes.map((n, i) => (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
            <span className="text-primary mt-0.5">·</span>
            <span className="flex-1">{n}</span>
          </p>
        ))}
      </div>

      {/* Partners toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 border-t border-border flex items-center justify-between text-xs font-medium text-primary hover:bg-muted transition-colors"
      >
        <span>{program.partners.length} transfer partners</span>
        <ChevronRight
          size={14}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Partners list */}
      {expanded && (
        <div className="border-t border-border bg-muted/30">
          {program.partners.map((p) => (
            <div key={p.airline} className="px-4 py-2.5 border-b border-border/50 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{p.airline}</span>
                    <span className="text-[10px] text-muted-foreground">{p.ratio}</span>
                  </div>
                  {p.sweetSpot && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {p.sweetSpot}
                    </p>
                  )}
                  {p.bonusNote && (
                    <p className="text-[11px] text-success mt-1 font-medium flex items-center gap-1">
                      <Sparkles size={10} />
                      {p.bonusNote}
                    </p>
                  )}
                </div>
                {p.bonusActive && (
                  <span className="text-[10px] font-bold bg-success/10 text-success px-1.5 py-0.5 rounded-full shrink-0">
                    HOT
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fee Analysis Card ───────────────────────────────────────────────────────

function FeeAnalysisCard({ card }: { card: CardAnnualFeeData }) {
  const totalValue = card.benefits.reduce((s, b) => s + b.value, 0);
  const verdictMeta = {
    keep: { label: "KEEP", color: "bg-success/10 text-success" },
    monitor: { label: "MONITOR", color: "bg-warning/10 text-warning" },
    downgrade: { label: "DOWNGRADE", color: "bg-destructive/10 text-destructive" },
  }[card.verdict];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-12 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: card.color, color: card.textColor }}
        >
          {card.shortName}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground">
            ${card.annualFee}/yr fee · ~${totalValue} in benefits
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${verdictMeta.color}`}>
          {verdictMeta.label}
        </span>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-2">
        {card.benefits.map((b, i) => (
          <div key={i} className="flex items-start justify-between gap-2 text-xs">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-foreground">{b.label}</span>
                {b.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{b.notes}</p>}
              </div>
            </div>
            <span className="text-foreground font-medium shrink-0">${b.value}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <p className="text-xs text-foreground leading-relaxed">{card.verdictNote}</p>
        {card.verdict === "downgrade" && (
          <Link
            href={`/strategy/downgrade/${card.id}`}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Start downgrade flow
            <ChevronRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Cards-to-Consider Card ──────────────────────────────────────────────────

function ConsiderCard({ card }: { card: CardToConsider }) {
  const fitColor =
    card.fitScore >= 8 ? "text-success" : card.fitScore >= 6 ? "text-warning" : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-foreground">{card.name}</p>
          <span className={`text-xs font-bold ${fitColor} shrink-0`}>
            {card.fitScore}/10 fit
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {card.issuer} · ${card.annualFee}/yr
        </p>

        {/* SUB Box */}
        <div className="mt-3 rounded-xl bg-accent border border-primary/20 p-3">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Current Bonus</p>
          <p className="text-xs text-foreground mt-0.5">{card.currentBonus}</p>
          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-primary/20">
            <span className="text-[11px] text-muted-foreground">{card.minSpend}</span>
            <span className="text-xs font-bold text-success">{card.bonusValue}</span>
          </div>
        </div>

        {/* Benefits */}
        <ul className="mt-3 flex flex-col gap-1.5">
          {card.keyBenefits.map((b, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
              <span className="text-primary mt-0.5">·</span>
              <span className="flex-1">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <p className="text-xs text-foreground leading-relaxed">{card.fitNote}</p>
      </div>
    </div>
  );
}

// ─── Live Alert Card (from Supabase alerts table) ────────────────────────────

function LiveAlertCard({
  alert,
  onDismiss,
}: {
  alert: LiveAlert;
  onDismiss: (id: string) => void;
}) {
  const meta = {
    high:   { color: "border-destructive/40 bg-destructive/5",  icon: <AlertTriangle size={14} className="text-destructive" /> },
    medium: { color: "border-warning/40 bg-warning/5",          icon: <Info size={14} className="text-warning" /> },
    low:    { color: "border-border bg-card",                   icon: <TrendingUp size={14} className="text-muted-foreground" /> },
    info:   { color: "border-primary/20 bg-primary/5",          icon: <Info size={14} className="text-primary" /> },
  }[alert.severity] ?? { color: "border-border bg-card", icon: <Info size={14} className="text-muted-foreground" /> };

  const created = new Date(alert.created_at);
  const daysAgo = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  const ageLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;

  return (
    <div className={`rounded-2xl border p-4 ${meta.color}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
          {alert.body && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.body}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{ageLabel}</p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="p-1 -mt-0.5 -mr-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Static Alert Card (strategy-data.ts evergreen notes) ────────────────────

function AlertCard({ alert }: { alert: StrategyAlert }) {
  const meta = {
    high: { color: "border-destructive/40 bg-destructive/5", icon: <AlertTriangle size={14} className="text-destructive" /> },
    medium: { color: "border-warning/40 bg-warning/5", icon: <Info size={14} className="text-warning" /> },
    low: { color: "border-border bg-card", icon: <TrendingUp size={14} className="text-muted-foreground" /> },
  }[alert.urgency];

  return (
    <div className={`rounded-2xl border p-4 ${meta.color}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.body}</p>
          {alert.expiresNote && (
            <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
              {alert.expiresNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
