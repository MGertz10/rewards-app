import type { BudgetData, MonthlyRecord, PointsBalance } from "./budget-seed";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardCurrentMonth {
  label: string;
  income: number;
  expenses: number;
  savings: number;
  netWorth: number;
  prevNetWorth: number;
}

export interface SpendCategory {
  category: string;
  amount: number;
  budget: number;
}

export interface NetWorthPoint {
  month: string;
  value: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
}

// Slim version of MonthlyRecord for client-side month switching
export interface MonthOption {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  netWorth: number;
  categories: Record<string, number>;
}

export interface DashboardData {
  currentMonth: DashboardCurrentMonth;
  spendByCategory: SpendCategory[];
  netWorthHistory: NetWorthPoint[];
  last6Months: MonthSummary[];
  pointsBalances: PointsBalance[];
  // All months + budgets so the client can switch months locally
  allMonths: MonthOption[];
  budgets: Record<string, number>;
  currentMonthIdx: number; // index into allMonths for the default view
}

// ─── Transform ───────────────────────────────────────────────────────────────

export function transformBudgetData(raw: BudgetData): DashboardData {
  const { months, budgets, pointsBalances } = raw;

  // All months with income > 0 or netWorth > 0
  const activeMonths = months.filter((m) => m.income > 0 || m.netWorth > 0);

  // Current month = last entry with income > 0
  const currentIdx = activeMonths.reduce(
    (best, m, i) => (m.income > 0 ? i : best),
    0
  );
  const current = activeMonths[currentIdx];
  const prev = activeMonths[currentIdx - 1] ?? null;

  const currentMonth: DashboardCurrentMonth = {
    label: current.month,
    income: current.income,
    expenses: current.expenses,
    savings: current.savings,
    netWorth: current.netWorth,
    prevNetWorth: prev?.netWorth ?? 0,
  };

  // Spend by category — current month, sorted by amount desc
  const spendByCategory = buildSpendByCategory(current, budgets);

  // Net worth history — months with netWorth tracked
  const netWorthHistory: NetWorthPoint[] = activeMonths
    .filter((m) => m.netWorth > 0)
    .map((m) => ({ month: m.month, value: m.netWorth }));

  // Last 6 months with income data
  const withIncome = activeMonths.filter((m) => m.income > 0);
  const last6Months: MonthSummary[] = withIncome.slice(-6).map((m) => ({
    month: m.month,
    income: m.income,
    expenses: m.expenses,
  }));

  // All months for client-side switching
  const allMonths: MonthOption[] = activeMonths.map((m) => ({
    month: m.month,
    income: m.income,
    expenses: m.expenses,
    savings: m.savings,
    netWorth: m.netWorth,
    categories: m.categories,
  }));

  return {
    currentMonth,
    spendByCategory,
    netWorthHistory,
    last6Months,
    pointsBalances,
    allMonths,
    budgets,
    currentMonthIdx: currentIdx,
  };
}

// ─── Helper (also exported for client-side month switching) ──────────────────

export function buildSpendByCategory(
  month: MonthlyRecord | MonthOption,
  budgets: Record<string, number>
): SpendCategory[] {
  return Object.entries(month.categories)
    .map(([category, amount]) => ({
      category,
      amount,
      budget: budgets[category] ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
