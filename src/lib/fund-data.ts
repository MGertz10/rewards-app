// Static fund metadata for common ETFs and mutual funds.
// Used by the portfolio analysis page for asset class, geographic, and fee analysis.
// When a ticker isn't here, we fall back to Plaid's asset_class field.

export type AssetClass = "equity" | "bond" | "real_estate" | "cash" | "commodity" | "crypto" | "other";
export type Geographic = "us" | "international" | "global" | "other";

export interface FundInfo {
  name: string;
  assetClass: AssetClass;
  category: string;         // e.g., "US Large Cap", "Total Bond Market"
  geographic: Geographic;
  expenseRatio?: number;    // annual %, e.g., 0.015 = 0.015%
}

export const FUND_DATA: Record<string, FundInfo> = {
  // ── Fidelity Index Funds ──────────────────────────────────────────────────
  FXAIX:  { name: "Fidelity 500 Index",                  assetClass: "equity",      category: "US Large Cap",         geographic: "us",            expenseRatio: 0.015  },
  FZROX:  { name: "Fidelity ZERO Total Market",          assetClass: "equity",      category: "US Total Market",      geographic: "us",            expenseRatio: 0      },
  FZILX:  { name: "Fidelity ZERO International Index",   assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0      },
  FXNAX:  { name: "Fidelity US Bond Index",              assetClass: "bond",        category: "US Bonds",             geographic: "us",            expenseRatio: 0.025  },
  FSKAX:  { name: "Fidelity Total Market Index",         assetClass: "equity",      category: "US Total Market",      geographic: "us",            expenseRatio: 0.015  },
  FSPGX:  { name: "Fidelity Large Cap Growth Index",     assetClass: "equity",      category: "US Large Cap Growth",  geographic: "us",            expenseRatio: 0.035  },
  FXAAX:  { name: "Fidelity Advisor 500 Index",          assetClass: "equity",      category: "US Large Cap",         geographic: "us",            expenseRatio: 0.1    },
  FSMAX:  { name: "Fidelity Extended Mkt Index",         assetClass: "equity",      category: "US Mid/Small Cap",     geographic: "us",            expenseRatio: 0.035  },
  FBIOX:  { name: "Fidelity Select Biotechnology",       assetClass: "equity",      category: "Sector - Healthcare",  geographic: "us",            expenseRatio: 0.69   },
  FDIVX:  { name: "Fidelity Diversified International",  assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.97   },
  FXAEX:  { name: "Fidelity Advisor International Idx",  assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.09   },
  FCNKX:  { name: "Fidelity Contrafund K",               assetClass: "equity",      category: "US Large Cap Growth",  geographic: "us",            expenseRatio: 0.59   },

  // ── Vanguard ETFs ──────────────────────────────────────────────────────────
  VOO:    { name: "Vanguard S&P 500 ETF",                assetClass: "equity",      category: "US Large Cap",         geographic: "us",            expenseRatio: 0.03   },
  VTI:    { name: "Vanguard Total Market ETF",           assetClass: "equity",      category: "US Total Market",      geographic: "us",            expenseRatio: 0.03   },
  VXUS:   { name: "Vanguard Total International",        assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.07   },
  VWO:    { name: "Vanguard Emerging Markets ETF",       assetClass: "equity",      category: "Emerging Markets",     geographic: "international", expenseRatio: 0.08   },
  VEA:    { name: "Vanguard Developed Markets ETF",      assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.05   },
  BND:    { name: "Vanguard Total Bond Market ETF",      assetClass: "bond",        category: "US Bonds",             geographic: "us",            expenseRatio: 0.03   },
  BNDX:   { name: "Vanguard Total Intl Bond ETF",        assetClass: "bond",        category: "International Bonds",  geographic: "international", expenseRatio: 0.07   },
  VNQ:    { name: "Vanguard Real Estate ETF",            assetClass: "real_estate", category: "US Real Estate",       geographic: "us",            expenseRatio: 0.12   },
  VIG:    { name: "Vanguard Dividend Appreciation ETF",  assetClass: "equity",      category: "US Dividend",          geographic: "us",            expenseRatio: 0.06   },
  VBTLX:  { name: "Vanguard Total Bond Idx Admiral",    assetClass: "bond",        category: "US Bonds",             geographic: "us",            expenseRatio: 0.05   },
  VTSAX:  { name: "Vanguard Total Stock Mkt Idx Adm",   assetClass: "equity",      category: "US Total Market",      geographic: "us",            expenseRatio: 0.04   },
  VTIAX:  { name: "Vanguard Total Intl Stock Idx Adm",  assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.11   },

  // ── iShares / SPDR ─────────────────────────────────────────────────────────
  SPY:    { name: "SPDR S&P 500 ETF",                    assetClass: "equity",      category: "US Large Cap",         geographic: "us",            expenseRatio: 0.0945 },
  IVV:    { name: "iShares Core S&P 500 ETF",            assetClass: "equity",      category: "US Large Cap",         geographic: "us",            expenseRatio: 0.03   },
  QQQ:    { name: "Invesco Nasdaq-100 ETF",              assetClass: "equity",      category: "US Large Cap Growth",  geographic: "us",            expenseRatio: 0.2    },
  AGG:    { name: "iShares Core US Aggregate Bond ETF",  assetClass: "bond",        category: "US Bonds",             geographic: "us",            expenseRatio: 0.03   },
  IEF:    { name: "iShares 7-10 Year Treasury ETF",      assetClass: "bond",        category: "US Treasury",          geographic: "us",            expenseRatio: 0.15   },
  LQD:    { name: "iShares iBoxx Investment Grade Corp", assetClass: "bond",        category: "Corp Bonds",           geographic: "us",            expenseRatio: 0.14   },
  EEM:    { name: "iShares MSCI Emerging Markets ETF",   assetClass: "equity",      category: "Emerging Markets",     geographic: "international", expenseRatio: 0.7    },
  EFA:    { name: "iShares MSCI EAFE ETF",               assetClass: "equity",      category: "International",        geographic: "international", expenseRatio: 0.32   },
  GLD:    { name: "SPDR Gold Shares",                    assetClass: "commodity",   category: "Commodities",          geographic: "global",        expenseRatio: 0.4    },
  SHV:    { name: "iShares Short Treasury Bond ETF",     assetClass: "cash",        category: "Cash Equivalent",      geographic: "us",            expenseRatio: 0.15   },

  // ── Merrill Lynch / BlackRock Target Date ──────────────────────────────────
  LIIFX:  { name: "BTC LifePath Index 2045",             assetClass: "equity",      category: "Target Date 2045",     geographic: "global",        expenseRatio: 0.07   },
  LIBFX:  { name: "BTC LifePath Index 2050",             assetClass: "equity",      category: "Target Date 2050",     geographic: "global",        expenseRatio: 0.07   },
  LICFX:  { name: "BTC LifePath Index 2055",             assetClass: "equity",      category: "Target Date 2055",     geographic: "global",        expenseRatio: 0.07   },
  LIDFX:  { name: "BTC LifePath Index 2060",             assetClass: "equity",      category: "Target Date 2060",     geographic: "global",        expenseRatio: 0.07   },
  LIEFX:  { name: "BTC LifePath Index 2065",             assetClass: "equity",      category: "Target Date 2065",     geographic: "global",        expenseRatio: 0.07   },

  // ── Common individual stocks (for ESPP / taxable accounts) ────────────────
  AAPL:   { name: "Apple Inc.",                          assetClass: "equity",      category: "Technology",           geographic: "us"             },
  MSFT:   { name: "Microsoft Corp.",                     assetClass: "equity",      category: "Technology",           geographic: "us"             },
  GOOGL:  { name: "Alphabet Inc.",                       assetClass: "equity",      category: "Technology",           geographic: "us"             },
  AMZN:   { name: "Amazon.com Inc.",                     assetClass: "equity",      category: "Consumer Discretionary", geographic: "us"           },
  TSLA:   { name: "Tesla Inc.",                          assetClass: "equity",      category: "Consumer Discretionary", geographic: "us"           },
  NVDA:   { name: "NVIDIA Corp.",                        assetClass: "equity",      category: "Technology",           geographic: "us"             },
  META:   { name: "Meta Platforms Inc.",                 assetClass: "equity",      category: "Technology",           geographic: "us"             },
  BRK:    { name: "Berkshire Hathaway",                  assetClass: "equity",      category: "Financials",           geographic: "us"             },
  "BRK.B":{ name: "Berkshire Hathaway B",                assetClass: "equity",      category: "Financials",           geographic: "us"             },

  // ── Money Market / Stable Value ────────────────────────────────────────────
  SPAXX:  { name: "Fidelity Government Money Market",   assetClass: "cash",        category: "Money Market",         geographic: "us",            expenseRatio: 0.42   },
  FDRXX:  { name: "Fidelity Government Cash Reserves",  assetClass: "cash",        category: "Money Market",         geographic: "us",            expenseRatio: 0.34   },
  VMFXX:  { name: "Vanguard Federal Money Market",      assetClass: "cash",        category: "Money Market",         geographic: "us",            expenseRatio: 0.11   },
};

// Normalize Plaid's asset_class strings to our AssetClass type
export function normalizeAssetClass(raw: string | null | undefined): AssetClass {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (lower.includes("equity") || lower.includes("stock")) return "equity";
  if (lower.includes("fixed") || lower.includes("bond") || lower.includes("debt")) return "bond";
  if (lower.includes("cash") || lower.includes("money market")) return "cash";
  if (lower.includes("real estate") || lower.includes("reit")) return "real_estate";
  if (lower.includes("commodity") || lower.includes("gold")) return "commodity";
  if (lower.includes("crypto")) return "crypto";
  return "other";
}

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity:      "Stocks",
  bond:        "Bonds",
  real_estate: "Real Estate",
  cash:        "Cash",
  commodity:   "Commodities",
  crypto:      "Crypto",
  other:       "Other",
};

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equity:      "#117ACA",   // primary blue
  bond:        "#22C55E",   // green
  real_estate: "#F5A623",   // gold
  cash:        "#94A3B8",   // slate
  commodity:   "#F59E0B",   // amber
  crypto:      "#8B5CF6",   // purple
  other:       "#64748B",   // muted
};
