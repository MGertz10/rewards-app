"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Info,
  MinusCircle,
  PlusCircle,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { loadCardMetadataFromDB, type AllCardMetadata } from "@/lib/card-user-data";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = "approved" | "pending" | "denied";

interface CreditApplication {
  id: string;
  cardName: string;
  /** ISO date string YYYY-MM-DD */
  appliedDate: string;
  status: ApprovalStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "credit_applications_v1";

/** Seed applications from known card open dates. These map 1:1 with the cards
 *  in lib/cards.ts and are stable — used as a base that the user can extend. */
const SEED_APPLICATIONS: CreditApplication[] = [
  { id: "seed_csp",       cardName: "Chase Sapphire Preferred",      appliedDate: "2024-03-25", status: "approved" },
  { id: "seed_cfu",       cardName: "Chase Freedom Unlimited",        appliedDate: "2024-04-29", status: "approved" },
  { id: "seed_boundless", cardName: "Marriott Bonvoy Boundless",      appliedDate: "2026-03-09", status: "approved" },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today(): Date {
  return new Date();
}

function parseDate(iso: string): Date {
  // Parse YYYY-MM-DD as local midnight to avoid TZ-offset surprises
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Add exactly 24 calendar months to a date */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Returns true if the date is within the last 24 months (5/24 window) */
function isWithin24Months(iso: string): boolean {
  const appDate = parseDate(iso);
  const cutoff = addMonths(today(), -24);
  return appDate >= cutoff;
}

/** Format a Date as "Mon YYYY" */
function formatMonYYYY(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Days from now (negative = in the past) */
function daysFromNow(date: Date): number {
  const ms = date.getTime() - today().getTime();
  return Math.round(ms / 86_400_000);
}

/** Human-readable relative time for a fall-off date */
function formatFallOff(iso: string): string {
  const fallOff = addMonths(parseDate(iso), 24);
  const days = daysFromNow(fallOff);
  if (days < 0) return "already fell off";
  if (days === 0) return "falls off today";
  if (days < 30) return `falls off in ${days}d`;
  const months = Math.round(days / 30.44);
  return `falls off in ~${months}mo`;
}

/** Compute average account age in months from an array of ISO date strings */
function avgAccountAgeMonths(openedDates: string[]): number {
  if (openedDates.length === 0) return 0;
  const now = today().getTime();
  const totalMs = openedDates.reduce((sum, iso) => {
    return sum + (now - parseDate(iso).getTime());
  }, 0);
  const avgMs = totalMs / openedDates.length;
  return avgMs / (1000 * 60 * 60 * 24 * 30.44); // approx months
}

function formatMonths(months: number): string {
  if (months < 1) return "< 1 month";
  if (months < 12) return `${Math.round(months)} months`;
  const years = Math.floor(months / 12);
  const rem = Math.round(months % 12);
  if (rem === 0) return `${years} yr${years !== 1 ? "s" : ""}`;
  return `${years} yr${years !== 1 ? "s" : ""} ${rem} mo`;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadApplications(): CreditApplication[] {
  if (typeof window === "undefined") return SEED_APPLICATIONS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED_APPLICATIONS;
    const parsed = JSON.parse(raw) as CreditApplication[];
    // Make sure seeds are always present (merge by id)
    const existingIds = new Set(parsed.map((a) => a.id));
    const merged = [...parsed];
    for (const seed of SEED_APPLICATIONS) {
      if (!existingIds.has(seed.id)) merged.push(seed);
    }
    return merged.sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));
  } catch {
    return SEED_APPLICATIONS;
  }
}

function saveApplications(apps: CreditApplication[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(apps));
}

// ─── Supabase card_balances fetch ─────────────────────────────────────────────

interface BalanceRow {
  current_balance: number | null;
  credit_limit: number | null;
}

async function fetchUtilization(): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("card_balances")
      .select("current_balance, credit_limit");
    if (error || !data) return null;
    const rows = data as BalanceRow[];
    const eligible = rows.filter((r) => r.credit_limit && r.credit_limit > 0);
    if (eligible.length === 0) return null;
    const totalBalance = eligible.reduce((s, r) => s + (r.current_balance ?? 0), 0);
    const totalLimit = eligible.reduce((s, r) => s + (r.credit_limit ?? 0), 0);
    return totalBalance / totalLimit;
  } catch {
    return null;
  }
}

// ─── Status tile ──────────────────────────────────────────────────────────────

function StatusTile({
  label,
  value,
  sub,
  urgency,
}: {
  label: string;
  value: string;
  sub: string;
  urgency: "ok" | "warn" | "bad" | "neutral";
}) {
  const valueColor =
    urgency === "ok"
      ? "text-success"
      : urgency === "warn"
      ? "text-warning"
      : urgency === "bad"
      ? "text-destructive"
      : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
        {label}
      </p>
      <p className={`text-xl font-bold leading-tight ${valueColor}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>
    </div>
  );
}

// ─── Overall verdict banner ───────────────────────────────────────────────────

type Verdict = "apply" | "monitor" | "wait";

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const meta: Record<Verdict, { icon: React.ReactNode; label: string; note: string; color: string }> = {
    apply: {
      icon: <CheckCircle2 size={18} className="text-success shrink-0" />,
      label: "Apply Now",
      note: "Your profile is clean — Chase-eligible, low utilization, solid account age.",
      color: "border-success/30 bg-success/5",
    },
    monitor: {
      icon: <AlertTriangle size={18} className="text-warning shrink-0" />,
      label: "Monitor First",
      note: "One or more factors need attention before your next application.",
      color: "border-warning/30 bg-warning/5",
    },
    wait: {
      icon: <XCircle size={18} className="text-destructive shrink-0" />,
      label: "Wait",
      note: "Address utilization or 5/24 count before applying for new cards.",
      color: "border-destructive/30 bg-destructive/5",
    },
  };
  const m = meta[verdict];

  return (
    <div className={`rounded-2xl border ${m.color} p-4 flex items-start gap-3`}>
      <div className="mt-0.5">{m.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Overall Verdict: {m.label}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.note}</p>
      </div>
    </div>
  );
}

// ─── Recommendation row ───────────────────────────────────────────────────────

function Recommendation({
  icon,
  text,
  urgency,
}: {
  icon: React.ReactNode;
  text: string;
  urgency: "ok" | "warn" | "bad" | "neutral";
}) {
  const bg =
    urgency === "ok"
      ? "bg-success/5 border-success/20"
      : urgency === "warn"
      ? "bg-warning/5 border-warning/20"
      : urgency === "bad"
      ? "bg-destructive/5 border-destructive/20"
      : "bg-muted/50 border-border";

  return (
    <div className={`rounded-xl border ${bg} px-3.5 py-3 flex items-start gap-2.5`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="text-xs text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Application log row ──────────────────────────────────────────────────────

const STATUS_META: Record<ApprovalStatus, { label: string; color: string; dot: string }> = {
  approved: { label: "Approved", color: "text-success", dot: "bg-success" },
  pending:  { label: "Pending",  color: "text-warning",  dot: "bg-warning" },
  denied:   { label: "Denied",   color: "text-destructive", dot: "bg-destructive" },
};

function AppLogRow({ app }: { app: CreditApplication }) {
  const inWindow = isWithin24Months(app.appliedDate);
  const fallOffDate = addMonths(parseDate(app.appliedDate), 24);
  const statusMeta = STATUS_META[app.status];
  const fallOffStr = formatFallOff(app.appliedDate);

  return (
    <div
      className={`rounded-xl border border-border bg-card px-3.5 py-3 ${
        inWindow ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold text-foreground ${inWindow ? "" : "line-through decoration-muted-foreground/50"}`}>
            {app.cardName}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Applied {formatMonYYYY(parseDate(app.appliedDate))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${statusMeta.color} flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
          <span
            className={`text-[10px] ${
              inWindow ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            {inWindow
              ? `Counts toward 5/24 · ${fallOffStr}`
              : `Fell off ${formatMonYYYY(fallOffDate)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Add application form ─────────────────────────────────────────────────────

function AddAppForm({
  onAdd,
  onClose,
}: {
  onAdd: (app: CreditApplication) => void;
  onClose: () => void;
}) {
  const [cardName, setCardName] = useState("");
  const [appliedDate, setAppliedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<ApprovalStatus>("approved");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardName.trim()) {
      setError("Card name is required.");
      return;
    }
    if (!appliedDate) {
      setError("Application date is required.");
      return;
    }
    const app: CreditApplication = {
      id: `app_${Date.now()}`,
      cardName: cardName.trim(),
      appliedDate,
      status,
    };
    onAdd(app);
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary/30 bg-accent p-4 flex flex-col gap-3"
    >
      <p className="text-sm font-semibold text-foreground">Log New Application</p>

      {error && (
        <p className="text-xs text-destructive font-medium">{error}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Card Name
        </label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="e.g. Amex Gold Card"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Date Applied
          </label>
          <input
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ApprovalStatus)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"
          >
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="denied">Denied</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          Save
        </button>
      </div>
    </form>
  );
}

// ─── 5/24 Countdown section ───────────────────────────────────────────────────

function FallOffCountdown({ apps }: { apps: CreditApplication[] }) {
  // Only count approved cards that are still within the 24-month window
  const inWindow = apps
    .filter((a) => a.status === "approved" && isWithin24Months(a.appliedDate))
    .sort((a, b) => a.appliedDate.localeCompare(b.appliedDate));

  if (inWindow.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-1">5/24 Countdown</p>
        <p className="text-xs text-muted-foreground">
          No approved cards in the 24-month window — you have maximum Chase eligibility.
        </p>
      </div>
    );
  }

  const oldest = inWindow[0];
  const nextSlotDate = addMonths(parseDate(oldest.appliedDate), 24);
  const daysToNextSlot = daysFromNow(nextSlotDate);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <p className="text-sm font-semibold text-foreground">5/24 Countdown</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          When each card exits the Chase 24-month window
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {inWindow.map((app) => {
          const fallOff = addMonths(parseDate(app.appliedDate), 24);
          const daysLeft = daysFromNow(fallOff);
          const isUrgent = daysLeft < 60;
          const isSoon = daysLeft < 180;

          return (
            <div key={app.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{app.cardName}</p>
                <p className="text-[11px] text-muted-foreground">
                  Applied {formatMonYYYY(parseDate(app.appliedDate))}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-xs font-semibold ${
                    isUrgent
                      ? "text-success"
                      : isSoon
                      ? "text-success"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatMonYYYY(fallOff)}
                </p>
                <p className={`text-[10px] ${isUrgent ? "text-success font-medium" : "text-muted-foreground"}`}>
                  {daysLeft <= 0 ? "Fell off" : `${daysLeft}d left`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-primary shrink-0" />
          <p className="text-[11px] text-foreground leading-snug">
            {daysToNextSlot <= 0 ? (
              <span className="text-success font-semibold">A Chase slot is already open — oldest card fell off.</span>
            ) : (
              <>
                Next Chase slot opens{" "}
                <span className="font-semibold text-primary">{formatMonYYYY(nextSlotDate)}</span>
                {" "}(in {daysToNextSlot}d) when{" "}
                <span className="font-semibold">{oldest.cardName}</span> falls off.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Hard inquiry editor ──────────────────────────────────────────────────────

const INQUIRY_LS_KEY = "credit_hard_inquiries_v1";

function loadInquiries(): number {
  if (typeof window === "undefined") return 2;
  try {
    const raw = localStorage.getItem(INQUIRY_LS_KEY);
    return raw !== null ? Number(raw) : 2;
  } catch {
    return 2;
  }
}

function saveInquiries(n: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INQUIRY_LS_KEY, String(n));
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreditOptimizerPage() {
  const [cardMeta, setCardMeta] = useState<AllCardMetadata>({});
  const [utilization, setUtilization] = useState<number | null>(null);
  const [inquiries, setInquiries] = useState(2);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load all data on mount
  useEffect(() => {
    async function init() {
      const [meta, util] = await Promise.all([
        loadCardMetadataFromDB(),
        fetchUtilization(),
      ]);
      setCardMeta(meta);
      setUtilization(util);
      setInquiries(loadInquiries());
      setApplications(loadApplications());
      setLoading(false);
    }
    init();
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────

  // 5/24 count: approved applications within 24 months
  const approvedInWindow = applications.filter(
    (a) => a.status === "approved" && isWithin24Months(a.appliedDate)
  );
  const fiveOf24Count = approvedInWindow.length;

  // Average account age from DB metadata first, then fall back to seed dates
  const openedDatesFromMeta = Object.values(cardMeta)
    .map((m) => m?.openedDate)
    .filter(Boolean) as string[];

  // Seed dates as fallback (covers cards before the user has metadata configured)
  const seedDates = ["2024-03-25", "2024-04-29", "2026-03-09"];
  const openedDates = openedDatesFromMeta.length > 0 ? openedDatesFromMeta : seedDates;
  const avgAgeMonths = avgAccountAgeMonths(openedDates);

  // ── Urgency signals ────────────────────────────────────────────────────────

  const chase524Urgency: "ok" | "warn" | "bad" =
    fiveOf24Count < 3 ? "ok" : fiveOf24Count < 5 ? "warn" : "bad";

  const utilizationUrgency: "ok" | "warn" | "bad" | "neutral" =
    utilization === null
      ? "neutral"
      : utilization < 0.1
      ? "ok"
      : utilization < 0.3
      ? "warn"
      : "bad";

  const avgAgeUrgency: "ok" | "warn" | "bad" | "neutral" =
    avgAgeMonths > 24 ? "ok" : avgAgeMonths > 12 ? "warn" : "bad";

  const inquiryUrgency: "ok" | "warn" | "bad" =
    inquiries <= 2 ? "ok" : inquiries <= 4 ? "warn" : "bad";

  // ── Overall verdict ────────────────────────────────────────────────────────
  const verdict: Verdict =
    utilizationUrgency === "bad" || fiveOf24Count >= 5
      ? "wait"
      : utilizationUrgency === "warn" || inquiryUrgency === "bad" || avgAgeUrgency === "bad"
      ? "monitor"
      : "apply";

  // ── Inquiry helpers ────────────────────────────────────────────────────────
  function changeInquiries(delta: number) {
    const next = Math.max(0, inquiries + delta);
    setInquiries(next);
    saveInquiries(next);
  }

  // ── Application log helpers ────────────────────────────────────────────────
  function handleAddApp(app: CreditApplication) {
    const next = [app, ...applications].sort((a, b) =>
      b.appliedDate.localeCompare(a.appliedDate)
    );
    setApplications(next);
    saveApplications(next);
    setShowAddForm(false);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen pb-8 max-w-lg mx-auto">
      <SubPageHeader
        title="Credit Optimizer"
        backHref="/strategy"
        subtitle="5/24 tracker, utilization & application log"
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading credit profile…</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4">
          {/* ── Status tiles ── */}
          <div className="grid grid-cols-2 gap-2">
            <StatusTile
              label="5/24 Status"
              value={`${fiveOf24Count}/24`}
              sub={
                fiveOf24Count < 5
                  ? `Chase eligible · ${5 - fiveOf24Count} slot${5 - fiveOf24Count !== 1 ? "s" : ""} left`
                  : "Chase locked · wait for falloff"
              }
              urgency={chase524Urgency}
            />
            <StatusTile
              label="Avg Account Age"
              value={formatMonths(avgAgeMonths)}
              sub={
                avgAgeMonths > 24
                  ? "Strong history"
                  : avgAgeMonths > 12
                  ? "Building — keep existing cards"
                  : "Young — avoid closing accounts"
              }
              urgency={avgAgeUrgency}
            />
            <StatusTile
              label="Utilization"
              value={
                utilization === null
                  ? "—"
                  : `${Math.round(utilization * 100)}%`
              }
              sub={
                utilization === null
                  ? "No balance data in DB yet"
                  : utilization < 0.1
                  ? "Excellent — under 10%"
                  : utilization < 0.3
                  ? "Good — under 30%"
                  : "High — pay down before applying"
              }
              urgency={utilizationUrgency}
            />
            {/* Hard inquiries tile — user-editable */}
            <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
                Hard Inquiries
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => changeInquiries(-1)}
                  aria-label="Decrease inquiries"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MinusCircle size={16} />
                </button>
                <p
                  className={`text-xl font-bold leading-tight tabular-nums ${
                    inquiryUrgency === "ok"
                      ? "text-success"
                      : inquiryUrgency === "warn"
                      ? "text-warning"
                      : "text-destructive"
                  }`}
                >
                  {inquiries}
                </p>
                <button
                  onClick={() => changeInquiries(1)}
                  aria-label="Increase inquiries"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <PlusCircle size={16} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {inquiries <= 2
                  ? "Clean — low impact"
                  : inquiries <= 4
                  ? "Moderate — some impact"
                  : "High — wait 6–12 months"}
              </p>
            </div>
          </div>

          {/* ── Overall verdict ── */}
          <VerdictBanner verdict={verdict} />

          {/* ── Recommendations ── */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Recommendations
            </p>

            {/* 5/24 recommendation */}
            <Recommendation
              urgency={chase524Urgency}
              icon={
                chase524Urgency === "ok" ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : chase524Urgency === "warn" ? (
                  <AlertTriangle size={14} className="text-warning" />
                ) : (
                  <XCircle size={14} className="text-destructive" />
                )
              }
              text={
                fiveOf24Count < 5
                  ? `Chase eligible — you're at ${fiveOf24Count}/24 with ${5 - fiveOf24Count} slot${5 - fiveOf24Count !== 1 ? "s" : ""} remaining. Prioritize Chase cards before using them up.`
                  : `5/24 locked — you've hit the Chase limit. Focus on non-Chase issuers (Amex, Capital One, Citi) until a card falls off.`
              }
            />

            {/* Utilization recommendation */}
            <Recommendation
              urgency={utilizationUrgency === "neutral" ? "neutral" : utilizationUrgency}
              icon={
                utilization === null ? (
                  <Info size={14} className="text-muted-foreground" />
                ) : utilizationUrgency === "ok" ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : utilizationUrgency === "warn" ? (
                  <AlertTriangle size={14} className="text-warning" />
                ) : (
                  <XCircle size={14} className="text-destructive" />
                )
              }
              text={
                utilization === null
                  ? "Utilization data not available — connect your accounts in Settings → Connected Accounts to see real-time utilization."
                  : utilization >= 0.3
                  ? `Utilization at ${Math.round(utilization * 100)}% — pay down balances below 30% before applying for new cards. Ideally aim for under 10%.`
                  : utilization >= 0.1
                  ? `Utilization at ${Math.round(utilization * 100)}% — solid, but getting below 10% before an application maximizes approval odds.`
                  : `Utilization at ${Math.round(utilization * 100)}% — excellent. This is the sweet spot for approvals.`
              }
            />

            {/* Account age recommendation */}
            <Recommendation
              urgency={avgAgeUrgency}
              icon={
                avgAgeUrgency === "ok" ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : avgAgeUrgency === "warn" ? (
                  <AlertTriangle size={14} className="text-warning" />
                ) : (
                  <Info size={14} className="text-muted-foreground" />
                )
              }
              text={
                avgAgeMonths > 24
                  ? `Avg account age ${formatMonths(avgAgeMonths)} — strong history. Each new card will bring this down slightly.`
                  : avgAgeMonths > 12
                  ? `Avg account age ${formatMonths(avgAgeMonths)} — building steadily. Avoid closing old accounts to protect this.`
                  : `Avg account age ${formatMonths(avgAgeMonths)} — your file is young. Don't close any existing cards; let history grow organically.`
              }
            />
          </div>

          {/* ── 5/24 countdown ── */}
          <FallOffCountdown apps={applications} />

          {/* ── Application log ── */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowLog((v) => !v)}
              className="flex items-center justify-between"
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Application Log
              </p>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard size={12} />
                <span className="text-[10px] font-medium">{applications.length} total</span>
                {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {showLog && (
              <div className="flex flex-col gap-2">
                {/* Legend */}
                <div className="flex items-center gap-3 px-1">
                  <span className="text-[10px] text-foreground font-semibold">Bold = in 24-month window</span>
                  <span className="text-[10px] text-muted-foreground">Faded = outside window</span>
                </div>

                {applications.map((app) => (
                  <AppLogRow key={app.id} app={app} />
                ))}

                {/* Add form or button */}
                {showAddForm ? (
                  <AddAppForm
                    onAdd={handleAddApp}
                    onClose={() => setShowAddForm(false)}
                  />
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="rounded-xl border border-dashed border-primary/40 bg-accent/50 py-3 flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-accent transition-colors"
                  >
                    <PlusCircle size={14} />
                    Log new application
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Footer note ── */}
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center pb-2">
            5/24 counts only Chase-approved cards within 24 months. Hard inquiry count is manually tracked — update it after each application. Utilization pulls from connected accounts.
          </p>
        </div>
      )}
    </div>
  );
}
