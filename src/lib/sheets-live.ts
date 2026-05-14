import { google } from "googleapis";
import type { BudgetData, MonthlyRecord } from "./budget-seed";
import { BUDGET_SEED } from "./budget-seed";

// Top-level categories that appear as row labels in the Summary sheet column B.
const CATEGORIES = [
  "Food", "Drinks", "Housing", "Transportation", "Entertainment",
  "Utilities", "Fees", "Health", "Personal Care", "Travel", "Gifts", "Taxes",
];

// "Apr '24" → "April 2024" (used nowhere in new structure, kept for debugging)
const MONTH_ABBRS: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April",
  May: "May", Jun: "June", Jul: "July", Aug: "August",
  Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};
void MONTH_ABBRS; // suppress unused warning — kept for future use

function toNum(raw: unknown): number {
  if (raw == null || raw === "" || raw === "$ -") return 0;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function fetchLiveData(): Promise<BudgetData> {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Summary!A1:AK210",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows: unknown[][] = (data.values as unknown[][] | null) ?? [];

  // ── locate header row (contains "Category" in col B = index 1) ─────────────
  const headerRowIdx = rows.findIndex((r) => r[1] === "Category");
  if (headerRowIdx === -1) throw new Error("Summary header row not found");

  const header = rows[headerRowIdx];

  // Month columns start at index 4 in the pandas view (col E in the sheet)
  const monthCols: { label: string; idx: number }[] = [];
  for (let i = 4; i < header.length; i++) {
    const h = String(header[i] ?? "").trim();
    if (h) monthCols.push({ label: h, idx: i });
  }

  // ── row lookup helpers ─────────────────────────────────────────────────────
  function findRow(label: string) {
    return rows.findIndex((r) => r[1] === label);
  }

  function val(rowIdx: number, colIdx: number): number {
    if (rowIdx === -1) return 0;
    return toNum(rows[rowIdx]?.[colIdx]);
  }

  const incomeRow   = findRow("Total Income");
  const expensesRow = findRow("Total Expenses");
  const savingsRow  = findRow("Total Savings");
  const nwRow       = findRow("Net Worth");

  // Pre-locate all category rows
  const categoryRows: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const idx = findRow(cat);
    if (idx !== -1) categoryRows[cat] = idx;
  }

  // ── find the most recent month with income data ────────────────────────────
  let currentMIdx = -1;
  for (let i = monthCols.length - 1; i >= 0; i--) {
    if (val(incomeRow, monthCols[i].idx) > 0) {
      currentMIdx = i;
      break;
    }
  }
  if (currentMIdx === -1) throw new Error("No income data found in Summary");

  // ── build monthly records for all months up to and including current ────────
  const months: MonthlyRecord[] = monthCols
    .slice(0, currentMIdx + 1)
    .map((m) => {
      const income   = val(incomeRow, m.idx);
      const expenses = val(expensesRow, m.idx);
      const savings  = val(savingsRow, m.idx);
      const netWorth = val(nwRow, m.idx);

      const categories: Record<string, number> = {};
      for (const [cat, rowIdx] of Object.entries(categoryRows)) {
        const amount = val(rowIdx, m.idx);
        if (amount > 0) categories[cat] = amount;
      }

      return { month: m.label, income, expenses, savings, netWorth, categories };
    })
    .filter((m) => m.income > 0 || m.netWorth > 0);

  return {
    months,
    budgets: BUDGET_SEED.budgets,   // budgets come from seed until a Budget sheet parser is added
    pointsBalances: BUDGET_SEED.pointsBalances, // no live source for points yet
  };
}
