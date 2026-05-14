"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { CARD_FEE_ANALYSIS } from "@/lib/strategy-data";
import { getMergedCard, loadCardMetadataFromDB } from "@/lib/card-user-data";
import { CARDS } from "@/lib/cards";
import type { Card } from "@/lib/cards";
import {
  nextRenewal,
  daysUntil,
  formatDateShort,
  formatRelativeDays,
  urgencyForDays,
} from "@/lib/card-events";

// Combine card metadata + verdict into a single calendar entry, sort by urgency.
type CalendarEntry = {
  cardId: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  annualFee: number;
  renewalDate: Date | null;
  days: number | null;
  verdict: "keep" | "downgrade" | "monitor" | "unknown";
  verdictNote: string;
  hasDowngradeTarget: boolean;
};

function buildEntries(cards: Card[], today: Date = new Date()): CalendarEntry[] {
  return cards
    .map((c) => {
      const analysis = CARD_FEE_ANALYSIS.find((a) => a.id === c.id);
      const renewalDate = nextRenewal(c, today);
      return {
        cardId: c.id,
        name: c.name,
        shortName: c.shortName,
        color: c.color,
        textColor: c.textColor,
        annualFee: c.annualFee,
        renewalDate,
        days: renewalDate ? daysUntil(renewalDate, today) : null,
        verdict: (analysis?.verdict ?? "unknown") as CalendarEntry["verdict"],
        verdictNote: analysis?.verdictNote ?? "",
        hasDowngradeTarget: !!c.downgradeTargetId,
      };
    })
    .filter((e) => e.annualFee > 0) // skip $0 fee cards
    .sort((a, b) => {
      // No-renewal entries last; otherwise nearest first
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });
}

export default function FeeCalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load from DB (Supabase via API route), fall back to localStorage
    loadCardMetadataFromDB().then((meta) => {
      const merged = CARDS.map((c) => getMergedCard(c, meta));
      setEntries(buildEntries(merged));
      setLoaded(true);
    });
  }, []);

  const totalAnnualFees = entries.reduce((s, e) => s + e.annualFee, 0);
  const hasMissingDates = entries.some((e) => e.days === null);

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SubPageHeader
        title="Annual Fee Calendar"
        backHref="/strategy"
        subtitle={
          loaded ? `$${totalAnnualFees}/yr across ${entries.length} cards` : "Loading…"
        }
      />

      {hasMissingDates && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2.5">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">
            Some cards are missing opening dates. Update them in{" "}
            <Link href="/settings/cards" className="text-primary font-medium underline">
              Settings → My Cards
            </Link>{" "}
            to get accurate renewal countdowns.
          </p>
        </div>
      )}

      <div className="px-4 flex flex-col gap-3">
        {entries.map((e) => (
          <CalendarRow key={e.cardId} entry={e} />
        ))}
      </div>
    </div>
  );
}

function CalendarRow({ entry }: { entry: CalendarEntry }) {
  const verdictMeta = {
    keep: { label: "KEEP", color: "bg-success/10 text-success" },
    monitor: { label: "MONITOR", color: "bg-warning/10 text-warning" },
    downgrade: { label: "DOWNGRADE", color: "bg-destructive/10 text-destructive" },
    unknown: { label: "REVIEW", color: "bg-muted text-muted-foreground" },
  }[entry.verdict];

  const urgency = entry.days != null ? urgencyForDays(entry.days, { high: 30, medium: 90 }) : "info";
  const urgencyColor =
    urgency === "high"
      ? "border-destructive/40"
      : urgency === "medium"
      ? "border-warning/40"
      : "border-border";

  return (
    <div className={`rounded-2xl border ${urgencyColor} bg-card overflow-hidden`}>
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-12 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: entry.color, color: entry.textColor }}
        >
          {entry.shortName}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{entry.name}</p>
          <p className="text-xs text-muted-foreground">${entry.annualFee} annual fee</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${verdictMeta.color}`}>
          {verdictMeta.label}
        </span>
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-muted-foreground" />
          {entry.renewalDate ? (
            <>
              <span className="text-xs font-medium text-foreground">
                {formatDateShort(entry.renewalDate)}
              </span>
              <span
                className={`text-[11px] ${
                  urgency === "high"
                    ? "text-destructive font-semibold"
                    : urgency === "medium"
                    ? "text-warning font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {formatRelativeDays(entry.days!)}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">No opening date set</span>
          )}
        </div>
        {entry.verdict === "downgrade" && entry.hasDowngradeTarget && (
          <Link
            href={`/strategy/downgrade/${entry.cardId}`}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            Start
            <ChevronRight size={12} />
          </Link>
        )}
      </div>

      {entry.verdictNote && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-foreground leading-relaxed">{entry.verdictNote}</p>
        </div>
      )}
    </div>
  );
}
