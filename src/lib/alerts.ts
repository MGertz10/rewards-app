// Alert generator functions — pure, no side effects.
// Each function returns alerts[] to upsert into Supabase.
// Called by the cron/generate-alerts route daily.

import { CARDS } from "./cards";
import { getMergedCards } from "./card-user-data";
import { nextRenewal, nextDueDate, nextStatementClose, daysUntil } from "./card-events";
import { POINTS_FULL } from "./points-balances";

export interface Alert {
  type: string;
  severity: "high" | "medium" | "low" | "info";
  title: string;
  body: string;
  due_at: string | null;
  payload: Record<string, unknown>;
}

// ── Payment due alerts ────────────────────────────────────────────────────────
// Fires 3 days before due date and 3 days before statement close.

export function generatePaymentAlerts(today: Date = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const merged = getMergedCards();

  for (const card of merged) {
    if (!card.dueDay || !card.statementCloseDay) continue;

    const dueDate = nextDueDate(card, today);
    const closeDate = nextStatementClose(card, today);

    if (dueDate) {
      const days = daysUntil(dueDate, today);
      if (days <= 3 && days >= 0) {
        alerts.push({
          type: "payment_due",
          severity: days === 0 ? "high" : "medium",
          title: `${card.shortName} payment due ${days === 0 ? "today" : `in ${days}d`}`,
          body: `Your ${card.name} payment is due on the ${card.dueDay}. Pay in full to avoid interest.`,
          due_at: dueDate.toISOString(),
          payload: { cardId: card.id, dueDay: card.dueDay },
        });
      }
    }

    if (closeDate) {
      const days = daysUntil(closeDate, today);
      if (days <= 3 && days >= 0) {
        alerts.push({
          type: "pay_to_report_low",
          severity: "medium",
          title: `${card.shortName} statement closes ${days === 0 ? "today" : `in ${days}d`}`,
          body: `Pay down ${card.name} before the ${card.statementCloseDay}th to report low utilization to credit bureaus.`,
          due_at: closeDate.toISOString(),
          payload: { cardId: card.id, closeDay: card.statementCloseDay },
        });
      }
    }
  }

  return alerts;
}

// ── Annual fee renewal alerts ─────────────────────────────────────────────────
// Fires at 90d and 30d before renewal.

export function generateFeeRenewalAlerts(today: Date = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const merged = getMergedCards();

  for (const card of merged) {
    if (!card.annualFee || card.annualFee === 0) continue;
    const renewal = nextRenewal(card, today);
    if (!renewal) continue;

    const days = daysUntil(renewal, today);

    if (days === 90) {
      alerts.push({
        type: "fee_renewal",
        severity: "low",
        title: `${card.shortName} fee renews in 90 days`,
        body: `$${card.annualFee} annual fee for ${card.name} renews in 3 months. Review your benefits usage.`,
        due_at: renewal.toISOString(),
        payload: { cardId: card.id, fee: card.annualFee, days },
      });
    } else if (days <= 30 && days >= 0) {
      alerts.push({
        type: "fee_renewal",
        severity: days <= 7 ? "high" : "medium",
        title: `${card.shortName} $${card.annualFee} fee in ${days}d`,
        body: `${card.name} annual fee posts ${days === 0 ? "today" : `in ${days} days`}. ${card.downgradeTargetId ? "Consider downgrading if benefits don't justify the cost." : ""}`,
        due_at: renewal.toISOString(),
        payload: { cardId: card.id, fee: card.annualFee, days },
      });
    }
  }

  return alerts;
}

// ── Points expiry alerts ───────────────────────────────────────────────────────
// Fires at 180d, 60d, 30d before expiry.

export function generatePointsExpiryAlerts(today: Date = new Date()): Alert[] {
  const alerts: Alert[] = [];

  for (const bal of POINTS_FULL) {
    if (!bal.expiresAt) continue;
    const days = daysUntil(new Date(bal.expiresAt), today);

    if (days === 180 || days === 60 || days <= 30) {
      const severity = days <= 30 ? "high" : days <= 60 ? "medium" : "low";
      const estValue = Math.round((bal.balance * bal.cpp) / 100);
      alerts.push({
        type: "points_expiry",
        severity,
        title: `${bal.programLabel} expires in ${days}d`,
        body: `${bal.balance.toLocaleString()} points (~$${estValue}) expire on ${bal.expiresAt}. Book a redemption before then.`,
        due_at: new Date(bal.expiresAt).toISOString(),
        payload: { program: bal.program, balance: bal.balance, days },
      });
    }

    // Cert expiry
    for (const cert of bal.certs ?? []) {
      const certDays = daysUntil(new Date(cert.nextExpiresAt), today);
      if (certDays <= 60) {
        alerts.push({
          type: "cert_expiry",
          severity: certDays <= 14 ? "high" : "medium",
          title: `${cert.count}x Free Night Cert expires in ${certDays}d`,
          body: `Your Marriott free night certificate (up to ${cert.maxPoints.toLocaleString()} pts) expires ${cert.nextExpiresAt}. Book now — ~$${cert.estValuePerCert} value.`,
          due_at: new Date(cert.nextExpiresAt).toISOString(),
          payload: { program: bal.program, certDays, estValue: cert.estValuePerCert },
        });
      }
    }
  }

  return alerts;
}

// ── Aggregate all alerts ──────────────────────────────────────────────────────

export function generateAllAlerts(today: Date = new Date()): Alert[] {
  return [
    ...generatePaymentAlerts(today),
    ...generateFeeRenewalAlerts(today),
    ...generatePointsExpiryAlerts(today),
  ];
}
