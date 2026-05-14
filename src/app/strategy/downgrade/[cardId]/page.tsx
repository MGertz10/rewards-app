"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Phone,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { getDowngradePath } from "@/lib/downgrade-paths";

export default function DowngradePage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  // Next.js 16: params is a Promise — unwrap with React's use()
  const { cardId } = use(params);
  const path = getDowngradePath(cardId);

  // Track which checklist items the user has confirmed before calling
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string>("checklist");

  if (!path) {
    return (
      <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
        <SubPageHeader title="Downgrade" backHref="/strategy" />
        <div className="px-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-foreground">No downgrade path defined for this card.</p>
            <Link href="/strategy" className="text-xs text-primary font-medium mt-2 inline-block">
              ← Back to Strategy Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked = path.preDowngradeChecklist.every((item) => completed.has(item.id));
  const annualSavings = path.fromAnnualFee - path.toAnnualFee;

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SubPageHeader
        title="Downgrade Flow"
        backHref="/strategy"
        subtitle={`${path.fromName} → ${path.toName}`}
      />

      {/* Hero summary */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-primary/30 bg-accent overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">From</p>
              <p className="text-sm font-semibold text-foreground">{path.fromName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">${path.fromAnnualFee}/yr</p>
            </div>
            <ArrowRight size={20} className="text-primary shrink-0" />
            <div className="flex-1 text-right">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">To</p>
              <p className="text-sm font-semibold text-foreground">{path.toName}</p>
              <p className="text-xs text-success font-medium mt-0.5">${path.toAnnualFee}/yr</p>
            </div>
          </div>
          <div className="bg-success/10 border-t border-success/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-foreground font-medium">Annual savings</span>
            <span className="text-sm font-bold text-success">${annualSavings}/yr</span>
          </div>
          {path.preserveHistory && (
            <div className="bg-muted/40 border-t border-border px-4 py-2 flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              <span className="text-[11px] text-foreground">
                Preserves account history — no new credit pull
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section: Pre-downgrade checklist */}
      <Section
        id="checklist"
        title="1. Before You Call"
        subtitle={`${completed.size}/${path.preDowngradeChecklist.length} ready`}
        open={openSection === "checklist"}
        onToggle={(id) => setOpenSection(openSection === id ? "" : id)}
      >
        <div className="flex flex-col gap-2.5">
          {path.preDowngradeChecklist.map((item) => {
            const checked = completed.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  checked ? "bg-success/5 border-success/30" : "bg-card border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {checked ? (
                    <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${checked ? "text-success" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    {item.warning && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-warning leading-snug">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <span>{item.warning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Section: Phone Script */}
      <Section
        id="script"
        title="2. Phone Script"
        subtitle={path.phoneScript.phone}
        locked={!allChecked}
        lockMessage="Complete the checklist above first"
        open={openSection === "script" && allChecked}
        onToggle={(id) => allChecked && setOpenSection(openSection === id ? "" : id)}
      >
        <div className="flex flex-col gap-3">
          <a
            href={`tel:${path.phoneScript.phone.replace(/\D/g, "")}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Phone size={14} />
            Call {path.phoneScript.phone}
          </a>
          <ol className="flex flex-col gap-2.5">
            {path.phoneScript.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">{step.label}</p>
                  {step.detail && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Section: What changes */}
      <Section
        id="changes"
        title="3. What Changes"
        open={openSection === "changes"}
        onToggle={(id) => setOpenSection(openSection === id ? "" : id)}
      >
        <div className="grid gap-3">
          <div>
            <p className="text-[10px] font-semibold text-success uppercase tracking-wider mb-1.5">You Keep</p>
            <ul className="flex flex-col gap-1.5">
              {path.whatYouKeep.map((item, i) => (
                <li key={i} className="text-xs text-foreground flex gap-1.5 leading-snug">
                  <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1.5">You Lose</p>
            <ul className="flex flex-col gap-1.5">
              {path.whatYouLose.map((item, i) => (
                <li key={i} className="text-xs text-foreground flex gap-1.5 leading-snug">
                  <AlertTriangle size={12} className="text-destructive shrink-0 mt-0.5" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Section: Timing */}
      <Section
        id="timing"
        title="4. Timing"
        open={openSection === "timing"}
        onToggle={(id) => setOpenSection(openSection === id ? "" : id)}
      >
        <ul className="flex flex-col gap-1.5">
          {path.timing.map((t, i) => (
            <li key={i} className="text-xs text-foreground flex gap-1.5 leading-snug">
              <Clock size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="flex-1">{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Section: Gotchas */}
      <Section
        id="gotchas"
        title="5. Gotchas"
        open={openSection === "gotchas"}
        onToggle={(id) => setOpenSection(openSection === id ? "" : id)}
      >
        <ul className="flex flex-col gap-1.5">
          {path.gotchas.map((g, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-1.5 leading-snug">
              <span className="text-warning mt-0.5">⚠</span>
              <span className="flex-1">{g}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ─── Collapsible section primitive ──────────────────────────────────────────

function Section({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  locked,
  lockMessage,
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  locked?: boolean;
  lockMessage?: string;
}) {
  return (
    <div className="mx-4 mb-3 rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        disabled={locked}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle && (
            <p className={`text-xs mt-0.5 ${locked ? "text-warning" : "text-muted-foreground"}`}>
              {locked ? lockMessage : subtitle}
            </p>
          )}
        </div>
        {!locked && (open ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </button>
      {open && !locked && <div className="px-4 pb-4 border-t border-border pt-3">{children}</div>}
    </div>
  );
}
