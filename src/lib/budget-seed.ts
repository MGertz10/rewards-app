// Seeded from Budget 2.0.xlsx — replace with live Google Sheets data once connected.
// Historical category data available for Food + Drinks across all months.
// All other categories are populated only for the most recent month.

export interface MonthlyRecord {
  month: string;                       // e.g. "Apr '24"
  income: number;
  expenses: number;
  savings: number;
  netWorth: number;                    // 0 = not yet tracked
  categories: Record<string, number>; // category → amount spent
}

export interface PointsBalance {
  program: string;
  points: number;
  cpp: number;   // cents per point
  card: string;
}

export interface BudgetData {
  months: MonthlyRecord[];             // chronological, oldest first
  budgets: Record<string, number>;     // monthly budget per category
  pointsBalances: PointsBalance[];
}

export const BUDGET_SEED: BudgetData = {
  months: [
    { month: "Apr '24", income: 2829.40, expenses: 8463.78, savings: -76.24,  netWorth: 0,          categories: { Food: 492.97, Drinks: 386.96 } },
    { month: "May '24", income: 10980.20, expenses: 3048.84, savings: -27.96, netWorth: 0,          categories: { Food: 523.96, Drinks: 325.56 } },
    { month: "Jun '24", income: 5545.82, expenses: 2624.24, savings: -51.26,  netWorth: 0,          categories: { Food: 550.68, Drinks: 234.56 } },
    { month: "Jul '24", income: 4672.46, expenses: 2302.34, savings: -44.96,  netWorth: 0,          categories: { Food: 555.01, Drinks: 174.82 } },
    { month: "Aug '24", income: 6045.65, expenses: 2316.85, savings: -20.07,  netWorth: 0,          categories: { Food: 398.75, Drinks: 151.88 } },
    { month: "Sep '24", income: 5018.72, expenses: 2223.86, savings: 2550.00, netWorth: 54643.71,   categories: { Food: 383.35, Drinks: 145.74 } },
    { month: "Oct '24", income: 5065.15, expenses: 2809.04, savings: 2500.00, netWorth: 57825.12,   categories: { Food: 680.32, Drinks: 73.73  } },
    { month: "Nov '24", income: 6234.29, expenses: 2523.79, savings: 1800.00, netWorth: 63860.10,   categories: { Food: 475.15, Drinks: 49.56  } },
    { month: "Dec '24", income: 5003.55, expenses: 2861.88, savings: 3500.00, netWorth: 67402.31,   categories: { Food: 489.32, Drinks: 109.15 } },
    { month: "Jan '25", income: 5103.87, expenses: 2741.46, savings: 1500.00, netWorth: 72027.52,   categories: { Food: 627.34, Drinks: 176.68 } },
    { month: "Feb '25", income: 4778.01, expenses: 2587.51, savings: 1750.00, netWorth: 74604.94,   categories: { Food: 605.14, Drinks: 27.67  } },
    { month: "Mar '25", income: 6026.10, expenses: 3575.95, savings: 2500.00, netWorth: 73875.73,   categories: { Food: 686.50, Drinks: 330.50 } },
    { month: "Apr '25", income: 4910.44, expenses: 3201.65, savings: 2652.89, netWorth: 75524.09,   categories: { Food: 623.23, Drinks: 155.40 } },
    { month: "May '25", income: 5155.30, expenses: 2987.36, savings: 5267.55, netWorth: 81462.74,   categories: { Food: 840.26, Drinks: 188.58 } },
    { month: "Jun '25", income: 5003.66, expenses: 2582.33, savings: 2890.60, netWorth: 85803.45,   categories: { Food: 464.07, Drinks: 179.56 } },
    { month: "Jul '25", income: 5246.12, expenses: 2952.07, savings: 4938.81, netWorth: 91148.50,   categories: { Food: 871.41, Drinks: 230.48 } },
    { month: "Aug '25", income: 5094.04, expenses: 4136.33, savings: 2794.49, netWorth: 94374.03,   categories: { Food: 664.70, Drinks: 389.49 } },
    { month: "Sep '25", income: 5344.11, expenses: 3764.48, savings: 2494.49, netWorth: 99725.57,   categories: { Food: 594.63, Drinks: 298.01 } },
    { month: "Oct '25", income: 5329.80, expenses: 3842.27, savings: 2994.49, netWorth: 104795.87,  categories: { Food: 567.48, Drinks: 22.67  } },
    { month: "Nov '25", income: 7209.55, expenses: 3624.51, savings: 7085.06, netWorth: 112841.33,  categories: { Food: 717.69, Drinks: 179.07 } },
    { month: "Dec '25", income: 4459.41, expenses: 2598.15, savings: 3523.05, netWorth: 115817.65,  categories: { Food: 351.53, Drinks: 119.46 } },
    { month: "Jan '26", income: 4383.59, expenses: 3226.90, savings: 6831.40, netWorth: 123693.13,  categories: { Food: 731.14, Drinks: 403.29 } },
    { month: "Feb '26", income: 4529.64, expenses: 2789.25, savings: 5331.40, netWorth: 127646.28,  categories: { Food: 865.53, Drinks: 46.41  } },
    { month: "Mar '26", income: 5218.60, expenses: 5387.01, savings: 1966.20, netWorth: 123449.81,  categories: { Food: 600.33, Drinks: 382.30 } },
    {
      month: "Apr '26",
      income: 2110.34,
      expenses: 1080.03,
      savings: 5914.32,
      netWorth: 130579.46,
      categories: {
        Food: 487.62,
        Drinks: 123.41,
        Health: 114.99,
        Fees: 103.74,
        Entertainment: 86.17,
        Utilities: 82.47,
        Transportation: 62.00,
        "Personal Care": 19.63,
      },
    },
  ],

  budgets: {
    Food: 594,
    Drinks: 196,
    Health: 120,
    Fees: 50,
    Entertainment: 150,
    Utilities: 100,
    Transportation: 120,
    "Personal Care": 50,
    Housing: 1355,
    Travel: 200,
    Gifts: 100,
  },

  pointsBalances: [
    { program: "Chase Ultimate Rewards", points: 12192, cpp: 1.7, card: "CSP + CFU" },
    { program: "Capital One Miles",      points: 102717, cpp: 1.5, card: "Venture X" },
    { program: "Marriott Bonvoy",        points: 63840,  cpp: 0.7, card: "Boundless" },
  ],
};
