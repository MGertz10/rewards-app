// Pure date helpers for card lifecycle events
// Used by: Annual Fee Calendar (F5), Payment Timing (F3), Credit Optimizer (F2)

import type { Card } from "./cards";

const MS_PER_DAY = 86_400_000;

// ─── Date helpers ────────────────────────────────────────────────────────────

export function daysUntil(target: Date, from: Date = new Date()): number {
  const t = startOfDay(target).getTime();
  const f = startOfDay(from).getTime();
  return Math.round((t - f) / MS_PER_DAY);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Clamp a desired day-of-month to a valid day for that month (handles 31 in Feb, etc.)
function clampDayOfMonth(year: number, month0: number, desiredDay: number): number {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return Math.min(desiredDay, lastDay);
}

// ─── Card events ─────────────────────────────────────────────────────────────

/**
 * Returns the next statement close date for a card.
 * If today is the close day, returns next month's close.
 */
export function nextStatementClose(card: Card, today: Date = new Date()): Date | null {
  if (!card.statementCloseDay) return null;
  const t = startOfDay(today);
  const day = clampDayOfMonth(t.getFullYear(), t.getMonth(), card.statementCloseDay);
  const thisMonthClose = new Date(t.getFullYear(), t.getMonth(), day);
  if (thisMonthClose.getTime() > t.getTime()) return thisMonthClose;
  // Move to next month
  const nextDay = clampDayOfMonth(t.getFullYear(), t.getMonth() + 1, card.statementCloseDay);
  return new Date(t.getFullYear(), t.getMonth() + 1, nextDay);
}

/**
 * Returns the next payment due date for a card.
 * Generally ~25 days after statement close.
 */
export function nextDueDate(card: Card, today: Date = new Date()): Date | null {
  if (!card.dueDay) return null;
  const t = startOfDay(today);
  const day = clampDayOfMonth(t.getFullYear(), t.getMonth(), card.dueDay);
  const thisMonthDue = new Date(t.getFullYear(), t.getMonth(), day);
  if (thisMonthDue.getTime() > t.getTime()) return thisMonthDue;
  const nextDay = clampDayOfMonth(t.getFullYear(), t.getMonth() + 1, card.dueDay);
  return new Date(t.getFullYear(), t.getMonth() + 1, nextDay);
}

/**
 * Returns the next annual fee renewal date.
 * Annual fees post on the anniversary of account opening.
 * Falls back to feeMonth if openedDate is unavailable, day = 1.
 */
export function nextRenewal(card: Card, today: Date = new Date()): Date | null {
  if (card.annualFee === 0) return null;
  const t = startOfDay(today);

  let anniversaryMonth: number;
  let anniversaryDay: number;

  if (card.openedDate) {
    const opened = new Date(card.openedDate);
    anniversaryMonth = opened.getMonth();
    anniversaryDay = opened.getDate();
  } else if (card.feeMonth) {
    anniversaryMonth = card.feeMonth - 1;
    anniversaryDay = 1;
  } else {
    return null;
  }

  const day = clampDayOfMonth(t.getFullYear(), anniversaryMonth, anniversaryDay);
  const thisYear = new Date(t.getFullYear(), anniversaryMonth, day);
  if (thisYear.getTime() > t.getTime()) return thisYear;
  const nextDay = clampDayOfMonth(t.getFullYear() + 1, anniversaryMonth, anniversaryDay);
  return new Date(t.getFullYear() + 1, anniversaryMonth, nextDay);
}

/**
 * Account age in months. Returns 0 if openedDate is missing.
 */
export function accountAgeMonths(card: Card, today: Date = new Date()): number {
  if (!card.openedDate) return 0;
  const opened = new Date(card.openedDate);
  const t = startOfDay(today);
  const months = (t.getFullYear() - opened.getFullYear()) * 12 + (t.getMonth() - opened.getMonth());
  return Math.max(0, months);
}

// ─── Formatting helpers (for UI) ─────────────────────────────────────────────

export function formatRelativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 30) return `in ${days} days`;
  if (days < 60) return `in ~1 month`;
  const months = Math.round(days / 30);
  return `in ~${months} months`;
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── Urgency tiers ───────────────────────────────────────────────────────────

export type UrgencyTier = "high" | "medium" | "low" | "info";

export function urgencyForDays(days: number, thresholds = { high: 14, medium: 60 }): UrgencyTier {
  if (days < 0) return "info";
  if (days <= thresholds.high) return "high";
  if (days <= thresholds.medium) return "medium";
  return "low";
}
