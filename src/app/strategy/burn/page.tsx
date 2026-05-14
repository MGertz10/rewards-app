"use client";

import Link from "next/link";
import { Flame, Award, AlertTriangle, ChevronRight, TrendingDown, Info } from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { POINTS_FULL, totalEstValue, type PointsBalanceFull } from "@/lib/points-balances";
import { daysUntil, formatRelativeDays, urgencyForDays, formatDateShort } from "@/lib/card-events";

export default function BurnTrackerPage() {
  const totalValue = totalEstValue();

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SubPageHeader
        title="Burn Tracker"
        backHref="/strategy"
        subtitle={`~$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} total value`}
      />

      {/* Total tile */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-primary/30 bg-accent p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Flame size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Redemption Value
              </p>
              <p className="text-2xl font-bold text-foreground">
                ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Points + certificates at conservative CPP
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="px-4 flex flex-col gap-3">
        {POINTS_FULL.map((b) => (
          <BalanceCard key={b.id} balance={b} />
        ))}
      </div>

      {/* Footer note */}
      <div className="px-4 mt-4">
        <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
          Cert expiry dates are estimates. Update them in{" "}
          <Link href="/settings/cards" className="text-primary font-medium underline">
            Settings → My Cards
          </Link>{" "}
          for accurate countdowns.
        </p>
      </div>
    </div>
  );
}

function BalanceCard({ balance }: { balance: PointsBalanceFull }) {
  const ptsValue = (balance.balance * balance.cpp) / 100;
  const ptsExpiryDays = balance.expiresAt ? daysUntil(new Date(balance.expiresAt)) : null;
  const ptsUrgency = ptsExpiryDays != null ? urgencyForDays(ptsExpiryDays, { high: 60, medium: 180 }) : "info";

  const borderColor =
    ptsUrgency === "high"
      ? "border-destructive/40"
      : ptsUrgency === "medium"
      ? "border-warning/40"
      : "border-border";

  return (
    <div className={`rounded-2xl border ${borderColor} bg-card overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: balance.color, color: balance.textColor }}
        >
          {balance.programLabel.split(" ")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{balance.programLabel}</p>
          <p className="text-xs text-muted-foreground">{balance.card}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{balance.balance.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">${ptsValue.toFixed(0)} est.</p>
        </div>
      </div>

      {/* Expiry strip */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-start gap-2">
        {ptsUrgency === "high" || ptsUrgency === "medium" ? (
          <AlertTriangle
            size={13}
            className={`shrink-0 mt-0.5 ${ptsUrgency === "high" ? "text-destructive" : "text-warning"}`}
          />
        ) : (
          <Info size={13} className="text-muted-foreground shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {balance.expiresAt ? (
            <p className="text-xs text-foreground leading-snug">
              Expires <span className="font-semibold">{formatDateShort(new Date(balance.expiresAt))}</span>
              {ptsExpiryDays != null && (
                <span
                  className={`ml-1 text-[11px] ${
                    ptsUrgency === "high"
                      ? "text-destructive font-semibold"
                      : ptsUrgency === "medium"
                      ? "text-warning font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  ({formatRelativeDays(ptsExpiryDays)})
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-foreground leading-snug">No fixed expiry</p>
          )}
          {balance.expiryNote && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{balance.expiryNote}</p>
          )}
        </div>
      </div>

      {/* Certs (if present) */}
      {balance.certs?.map((cert, i) => {
        const days = daysUntil(new Date(cert.nextExpiresAt));
        const certUrgency = urgencyForDays(days, { high: 60, medium: 180 });
        const certBg =
          certUrgency === "high"
            ? "bg-destructive/5 border-destructive/30"
            : certUrgency === "medium"
            ? "bg-warning/5 border-warning/30"
            : "bg-success/5 border-success/30";

        return (
          <div key={i} className={`mx-4 my-3 rounded-xl border p-3 ${certBg}`}>
            <div className="flex items-start gap-2.5">
              <Award size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {cert.count} × Free Night Certificate{cert.count !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Up to {cert.maxPoints.toLocaleString()} pts each · ~${cert.estValuePerCert} value at right
                  property · ~${cert.count * cert.estValuePerCert} total
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <TrendingDown
                    size={11}
                    className={
                      certUrgency === "high"
                        ? "text-destructive"
                        : certUrgency === "medium"
                        ? "text-warning"
                        : "text-success"
                    }
                  />
                  <span
                    className={`text-[11px] font-semibold ${
                      certUrgency === "high"
                        ? "text-destructive"
                        : certUrgency === "medium"
                        ? "text-warning"
                        : "text-success"
                    }`}
                  >
                    Next cert expires {formatRelativeDays(days)} ({formatDateShort(new Date(cert.nextExpiresAt))})
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Action footer */}
      <Link
        href={`/trip-planner?program=${balance.program}`}
        className="block px-4 py-3 border-t border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">Plan a redemption</span>
          <ChevronRight size={14} className="text-primary" />
        </div>
      </Link>
    </div>
  );
}
