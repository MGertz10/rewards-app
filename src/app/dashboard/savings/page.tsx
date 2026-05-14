"use client";

import { useState } from "react";
import {
  Shield, TrendingUp, Target, Landmark, PiggyBank,
  ChevronRight, CheckCircle, Edit3, X, Info, Zap,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { BottomNav } from "@/components/bottom-nav";

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountType = "emergency" | "match_401k" | "hsa" | "roth_ira" | "trad_401k" | "brokerage";

interface SavingsAccount {
  id: AccountType;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  priority: number;
  description: string;
  whyFirst: string;
  currentBalance: number;
  annualTarget: number | null;   // null = balance-based goal
  balanceTarget: number | null;  // null = contribution-limited
  annualContrib: number;         // what you're contributing per year
  annualLimit: number | null;    // IRS/plan limit per year
  institution: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function statusColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60)  return "bg-primary";
  if (pct >= 30)  return "bg-amber-500";
  return "bg-destructive";
}

function statusLabel(pct: number, acct: SavingsAccount): string {
  if (pct >= 100) return "✓ Goal reached";
  if (acct.balanceTarget) return `$${fmt(acct.balanceTarget - acct.currentBalance)} to go`;
  if (acct.annualTarget) {
    const remaining = acct.annualTarget - acct.annualContrib;
    return remaining > 0 ? `$${fmt(remaining)}/yr remaining` : "✓ Maxed";
  }
  return "";
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  acct,
  onSave,
  onClose,
}: {
  acct: SavingsAccount;
  onSave: (updates: Partial<SavingsAccount>) => void;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState(acct.currentBalance.toString());
  const [contrib, setContrib] = useState(acct.annualContrib.toString());
  const [institution, setInstitution] = useState(acct.institution);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">{acct.label}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <X size={13} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Current Balance ($)</label>
            <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)}
              className="w-full rounded-xl border border-border bg-background text-base font-bold text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Annual Contribution ($)
              {acct.annualLimit && (
                <span className="ml-1 text-muted-foreground font-normal">· limit: ${fmt(acct.annualLimit)}</span>
              )}
            </label>
            <input type="number" value={contrib} onChange={(e) => setContrib(e.target.value)}
              className="w-full rounded-xl border border-border bg-background text-base font-bold text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Institution</label>
            <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)}
              className="w-full rounded-xl border border-border bg-background text-sm text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                currentBalance: parseFloat(balance) || 0,
                annualContrib: parseFloat(contrib) || 0,
                institution,
              });
              onClose();
            }}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Account card ──────────────────────────────────────────────────────────────

function AccountCard({
  acct,
  isNext,
  amount,
  onEdit,
}: {
  acct: SavingsAccount;
  isNext: boolean;
  amount: number;
  onEdit: () => void;
}) {
  const Icon = acct.icon;
  const goalAmt = acct.balanceTarget ?? acct.annualTarget ?? 0;
  const currentForPct = acct.balanceTarget ? acct.currentBalance : acct.annualContrib;
  const pct = goalAmt > 0 ? Math.min(100, (currentForPct / goalAmt) * 100) : 0;
  const reached = pct >= 100;

  // How much of the $amount input should go here
  const needed = goalAmt > 0 ? Math.max(0, goalAmt - currentForPct) : 0;
  const allocate = Math.min(amount, needed);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isNext
        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
        : reached
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border bg-card"
    }`}>
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Priority badge */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
          reached ? "bg-emerald-500 text-white" : isNext ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        }`}>
          {reached ? "✓" : acct.priority}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: acct.iconColor + "20" }}>
              <Icon size={13} style={{ color: acct.iconColor }} />
            </div>
            <p className="text-sm font-bold text-foreground">{acct.label}</p>
            {isNext && (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={7} />NEXT
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-base font-bold text-foreground">${fmt(acct.currentBalance)}</p>
            {acct.annualContrib > 0 && (
              <p className="text-xs text-muted-foreground">${fmt(acct.annualContrib)}/yr contributed</p>
            )}
          </div>

          {acct.institution && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{acct.institution}</p>
          )}

          {/* Progress bar */}
          {goalAmt > 0 && (
            <div className="mt-2">
              <div className="flex justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">{statusLabel(pct, acct)}</p>
                <p className="text-[10px] font-semibold text-foreground">{fmtPct(pct)}</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${statusColor(pct)}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Goal: {acct.balanceTarget ? `$${fmt(acct.balanceTarget)} balance` : `$${fmt(acct.annualTarget!)} / yr`}
                {acct.annualLimit && ` · IRS limit $${fmt(acct.annualLimit)}`}
              </p>
            </div>
          )}

          {/* Allocation suggestion */}
          {isNext && amount > 0 && allocate > 0 && (
            <div className="mt-2 rounded-xl bg-primary/10 px-2.5 py-1.5">
              <p className="text-[11px] font-bold text-primary">
                → Put ${fmt(allocate)} here first
                {allocate < amount && ` · $${fmt(amount - allocate)} flows to next priority`}
              </p>
            </div>
          )}
        </div>

        <button onClick={onEdit}
          className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Edit3 size={13} className="text-muted-foreground" />
        </button>
      </div>

      {/* Why this priority */}
      <div className="px-4 pb-3 pt-0 border-t border-border/40">
        <div className="flex gap-1.5 items-start mt-2">
          <Info size={10} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-snug">{acct.whyFirst}</p>
        </div>
      </div>
    </div>
  );
}

// ── Default account data (user-specific seed) ─────────────────────────────────

const DEFAULT_ACCOUNTS: SavingsAccount[] = [
  {
    id: "emergency",
    label: "Emergency Fund",
    icon: Shield,
    iconColor: "#22c55e",
    priority: 1,
    description: "3–6 months of living expenses in liquid savings",
    whyFirst: "Before anything else — protects all other investments from being liquidated in a crisis. Target: 3× monthly expenses (~$15K at your spend level).",
    currentBalance: 5000,
    annualTarget: null,
    balanceTarget: 15000,
    annualContrib: 0,
    annualLimit: null,
    institution: "Marcus / Checking",
  },
  {
    id: "match_401k",
    label: "401k — Employer Match",
    icon: Landmark,
    iconColor: "#117ACA",
    priority: 2,
    description: "Contribute enough to capture 100% of employer match",
    whyFirst: "Instant 50–100% return on matched dollars. Never leave free money on the table — this beats every other investment.",
    currentBalance: 28611,
    annualTarget: 3000,  // typical match capture amount — user should update
    balanceTarget: null,
    annualContrib: 3000,
    annualLimit: 23500,
    institution: "Merrill Lynch (Accenture 401k)",
  },
  {
    id: "hsa",
    label: "HSA",
    icon: Target,
    iconColor: "#8b5cf6",
    priority: 3,
    description: "Health Savings Account — triple tax advantage",
    whyFirst: "Triple tax-advantaged: pre-tax contributions, tax-free growth, tax-free withdrawals for medical. Best account type available — max it.",
    currentBalance: 3845,
    annualTarget: 4300,
    balanceTarget: null,
    annualContrib: 3250, // based on ~$162.50 × 20 payroll deductions seen
    annualLimit: 4300,
    institution: "Bank of America / Inspira",
  },
  {
    id: "roth_ira",
    label: "Roth IRA",
    icon: TrendingUp,
    iconColor: "#f59e0b",
    priority: 4,
    description: "Tax-free growth and withdrawals in retirement",
    whyFirst: "At 25 with decades of compound growth ahead, tax-free Roth growth is more valuable than a 401k deduction. Max the $7,000 limit annually.",
    currentBalance: 26478,
    annualTarget: 7000,
    balanceTarget: null,
    annualContrib: 0,  // user should confirm if maxing
    annualLimit: 7000,
    institution: "Fidelity (Roth IRA - 1566)",
  },
  {
    id: "trad_401k",
    label: "401k — Max Out",
    icon: Landmark,
    iconColor: "#0ea5e9",
    priority: 5,
    description: "Max out traditional 401k beyond employer match",
    whyFirst: "Pre-tax contributions lower your taxable income now. After Roth is maxed, push 401k to the $23,500 annual limit.",
    currentBalance: 28611,
    annualTarget: 23500,
    balanceTarget: null,
    annualContrib: 3000,
    annualLimit: 23500,
    institution: "Merrill Lynch (Accenture 401k)",
  },
  {
    id: "brokerage",
    label: "Taxable Brokerage",
    icon: PiggyBank,
    iconColor: "#ec4899",
    priority: 6,
    description: "Invest remaining dollars in taxable account",
    whyFirst: "After all tax-advantaged accounts are maxed, invest here. No limits, fully flexible — your primary long-term wealth builder.",
    currentBalance: 68960,
    annualTarget: null,
    balanceTarget: null,
    annualContrib: 0,
    annualLimit: null,
    institution: "Fidelity Investments (0150)",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SavingsPlanPage() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>(DEFAULT_ACCOUNTS);
  const [editingId, setEditingId] = useState<AccountType | null>(null);
  const [investAmount, setInvestAmount] = useState(1000);

  function updateAccount(id: AccountType, updates: Partial<SavingsAccount>) {
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  }

  // Find the next priority that hasn't reached its goal
  const nextPriorityId = accounts.find((a) => {
    const goalAmt = a.balanceTarget ?? a.annualTarget ?? 0;
    if (goalAmt === 0) return false;
    const currentForPct = a.balanceTarget ? a.currentBalance : a.annualContrib;
    return currentForPct < goalAmt;
  })?.id ?? null;

  // Total invested
  const totalInvested = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const accountsComplete = accounts.filter((a) => {
    const goalAmt = a.balanceTarget ?? a.annualTarget ?? 0;
    if (goalAmt === 0) return false;
    const currentForPct = a.balanceTarget ? a.currentBalance : a.annualContrib;
    return currentForPct >= goalAmt;
  }).length;
  const accountsWithGoal = accounts.filter((a) => (a.balanceTarget ?? a.annualTarget ?? 0) > 0).length;

  const editingAcct = editingId ? accounts.find((a) => a.id === editingId) : null;

  // Walk the priority list and allocate $investAmount across unfilled accounts
  let remaining = investAmount;
  const allocations: Record<string, number> = {};
  for (const acct of accounts) {
    const goalAmt = acct.balanceTarget ?? acct.annualTarget ?? 0;
    if (goalAmt === 0) {
      // brokerage — dump everything remaining here last
      continue;
    }
    const current = acct.balanceTarget ? acct.currentBalance : acct.annualContrib;
    const needed = Math.max(0, goalAmt - current);
    const alloc = Math.min(remaining, needed);
    allocations[acct.id] = alloc;
    remaining -= alloc;
    if (remaining <= 0) break;
  }
  // Remainder goes to brokerage
  if (remaining > 0) allocations["brokerage"] = remaining;

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      <SubPageHeader
        title="Savings Prioritizer"
        backHref="/dashboard"
        subtitle="Where your next dollar should go"
      />

      <div className="flex flex-col gap-4 px-4">

        {/* Summary */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Saved / Invested</p>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {accountsComplete}/{accountsWithGoal} goals hit
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">${fmt(totalInvested)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts.length} accounts · Tap any card to update balances
          </p>
        </div>

        {/* "If I have $X" calculator */}
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            If I have this much to invest…
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground">$</span>
            <input
              type="number"
              value={investAmount}
              onChange={(e) => setInvestAmount(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 rounded-xl border border-border bg-background text-lg font-bold text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {nextPriorityId && (
            <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2.5 flex items-center gap-2">
              <Zap size={13} className="text-primary shrink-0" />
              <p className="text-xs font-semibold text-primary">
                First priority: {accounts.find((a) => a.id === nextPriorityId)?.label} —{" "}
                ${fmt(allocations[nextPriorityId] ?? 0)} goes here
              </p>
            </div>
          )}
        </div>

        {/* Priority — how it works */}
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Priority Order</p>
          <div className="flex flex-col gap-1.5">
            {[
              "Emergency fund (3–6 mo expenses) — liquidity first",
              "401k match — free money, instant return",
              "HSA — triple tax advantage",
              "Roth IRA — tax-free compound growth for decades",
              "Max 401k — pre-tax savings up to limit",
              "Taxable brokerage — no limits, long-term wealth",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[11px] text-muted-foreground leading-snug">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Account cards */}
        <div className="flex flex-col gap-3">
          {accounts.map((acct) => (
            <AccountCard
              key={acct.id}
              acct={acct}
              isNext={acct.id === nextPriorityId}
              amount={allocations[acct.id] ?? 0}
              onEdit={() => setEditingId(acct.id)}
            />
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center pb-2 leading-relaxed">
          IRS limits for 2025/2026: 401k $23,500 · Roth IRA $7,000 · HSA (individual) $4,300.
          Balances are manually updated — edit each card to keep them accurate.
        </p>
      </div>

      {editingAcct && (
        <EditModal
          acct={editingAcct}
          onSave={(updates) => updateAccount(editingAcct.id, updates)}
          onClose={() => setEditingId(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
