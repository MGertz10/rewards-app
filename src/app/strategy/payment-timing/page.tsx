"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, TrendingDown, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { getMergedCard, loadCardMetadataFromDB } from "@/lib/card-user-data";
import { CARDS } from "@/lib/cards";
import { nextDueDate, nextStatementClose, daysUntil, formatDateShort, formatRelativeDays, urgencyForDays } from "@/lib/card-events";
import type { Card } from "@/lib/cards";

// ── Payment strategy math ─────────────────────────────────────────────────────

interface PaymentPlan {
  card: Card;
  // Statement close
  closeDate: Date | null;
  closeDays: number | null;
  // "Pay to report low" = 3 days before statement close
  payLowDate: Date | null;
  payLowDays: number | null;
  // Payment due
  dueDate: Date | null;
  dueDays: number | null;
  // Utilization targets
  creditLimit: number | null;
  // Target balance to report on statement: ≤9% of credit limit
  // When Plaid is connected: recommend paying (current_balance - targetBalance)
  // Until then: show the target balance as the goal
  targetBalance: number | null;
  targetPct: number; // 9% threshold
}

async function buildPlans(today: Date = new Date()): Promise<PaymentPlan[]> {
  // Load metadata from DB first (falls back to localStorage if API is unavailable)
  const meta = await loadCardMetadataFromDB();
  const cards = CARDS.map((c) => getMergedCard(c, meta)).filter(
    (c) => c.catchAllMultiplier > 0 || c.multipliers.length > 0
  );

  return cards.map((card) => {
    const closeDate = nextStatementClose(card, today);
    const dueDate = nextDueDate(card, today);
    const limit = card.creditLimit ?? null;
    // Target: keep reported balance ≤ 9% of credit limit
    const targetBalance = limit ? Math.floor(limit * 0.09) : null;

    // "Pay to report low" = 3 days before statement close
    // This is the last day to pay down to targetBalance before the balance is reported
    let payLowDate: Date | null = null;
    if (closeDate) {
      payLowDate = new Date(closeDate);
      payLowDate.setDate(payLowDate.getDate() - 3);
    }

    return {
      card,
      closeDate,
      closeDays: closeDate ? daysUntil(closeDate, today) : null,
      payLowDate,
      payLowDays: payLowDate ? daysUntil(payLowDate, today) : null,
      dueDate,
      dueDays: dueDate ? daysUntil(dueDate, today) : null,
      creditLimit: limit,
      targetBalance,
      targetPct: 9,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateRow({
  icon: Icon,
  label,
  date,
  days,
  urgency,
  note,
}: {
  icon: React.ElementType;
  label: string;
  date: Date | null;
  days: number | null;
  urgency: string;
  note?: string;
}) {
  const urgencyColor =
    urgency === "high"
      ? "text-destructive"
      : urgency === "medium"
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={15} className={`shrink-0 mt-0.5 ${urgencyColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {note && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{note}</p>}
      </div>
      <div className="text-right shrink-0">
        {date ? (
          <>
            <p className="text-xs font-semibold text-foreground">{formatDateShort(date)}</p>
            {days !== null && (
              <p className={`text-[11px] font-medium ${urgencyColor}`}>
                {formatRelativeDays(days)}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Not set</p>
        )}
      </div>
    </div>
  );
}

function PaymentCard({ plan }: { plan: PaymentPlan }) {
  const { card, closeDate, closeDays, payLowDate, payLowDays, dueDate, dueDays, creditLimit, targetBalance } = plan;

  const payLowUrgency = payLowDays != null ? urgencyForDays(payLowDays, { high: 3, medium: 7 }) : "info";
  const dueUrgency = dueDays != null ? urgencyForDays(dueDays, { high: 3, medium: 7 }) : "info";
  const borderUrgency = [payLowUrgency, dueUrgency].includes("high")
    ? "border-destructive/40"
    : [payLowUrgency, dueUrgency].includes("medium")
    ? "border-warning/40"
    : "border-border";

  const missingDates = !closeDate && !dueDate;

  return (
    <div className={`rounded-2xl border ${borderUrgency} bg-card overflow-hidden`}>
      {/* Card header */}
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
            {creditLimit ? `$${creditLimit.toLocaleString()} limit` : "No limit set"}
          </p>
        </div>
      </div>

      {missingDates ? (
        <div className="px-4 pb-4 flex items-start gap-2">
          <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-snug">
            Add billing dates in{" "}
            <a href="/settings/cards" className="text-primary underline font-medium">
              Settings → My Cards
            </a>{" "}
            to see payment timing.
          </p>
        </div>
      ) : (
        <div className="border-t border-border px-4 divide-y divide-border">
          <DateRow
            icon={TrendingDown}
            label="Pay to report low"
            date={payLowDate}
            days={payLowDays}
            urgency={payLowUrgency}
            note={
              targetBalance != null
                ? `Pay down to $${targetBalance.toLocaleString()} by this date (3 days before statement close) to report ≤9% utilization`
                : "Pay down 3 days before statement close to report low utilization"
            }
          />
          <DateRow
            icon={CalendarDays}
            label="Statement closes"
            date={closeDate}
            days={closeDays}
            urgency="info"
            note="Balance reported to credit bureaus on this date"
          />
          <DateRow
            icon={CreditCard}
            label="Payment due"
            date={dueDate}
            days={dueDays}
            urgency={dueUrgency}
            note="Latest date to pay statement balance and avoid interest"
          />
        </div>
      )}

      {/* Utilization target */}
      {creditLimit && targetBalance != null && (
        <div className="mx-4 mb-4 mt-1 rounded-xl bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={13} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Optimal utilization target</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Pay down to</p>
              <p className="text-lg font-bold text-primary">${targetBalance.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Reports as</p>
              <p className="text-sm font-bold text-success">≤9% utilization</p>
            </div>
          </div>
          <div className="mt-2 w-full bg-muted rounded-full h-1.5">
            <div className="bg-success h-1.5 rounded-full" style={{ width: "9%" }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
            Credit bureaus see your statement balance. Keeping it under 10% of your limit is the single biggest quick-win for your credit score.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentTimingPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);

  useEffect(() => {
    buildPlans().then(setPlans);
  }, []);

  const hasUrgent = plans.some(
    (p) =>
      (p.payLowDays != null && p.payLowDays <= 3) ||
      (p.dueDays != null && p.dueDays <= 3)
  );

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SubPageHeader
        title="Payment Timing"
        backHref="/strategy"
        subtitle="When to pay for maximum benefit"
      />

      {/* Explainer */}
      <div className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-accent p-4">
        <p className="text-xs font-semibold text-foreground mb-1.5">Two dates, two different goals</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <TrendingDown size={13} className="text-success shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">Before statement close</span> — pay down to ≤9% of your limit so the credit bureau sees a low balance. Biggest credit score lever.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">By payment due date</span> — pay the statement balance in full to avoid interest. Keep your cash earning interest until then.
            </p>
          </div>
        </div>
      </div>

      {hasUrgent && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5">
          <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-foreground font-medium">Action needed — payment or statement close within 3 days.</p>
        </div>
      )}

      <div className="px-4 flex flex-col gap-4">
        {plans.map((p) => (
          <PaymentCard key={p.card.id} plan={p} />
        ))}
      </div>

      <div className="px-4 mt-4">
        <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
          <Info size={13} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Once Plaid is connected, current balances will show here automatically and the optimal paydown amount will update in real time.
          </p>
        </div>
      </div>
    </div>
  );
}
