"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { useCardNameMap } from "@/lib/use-card-name-map";
import { CARDS, getMultiplier, CPP } from "@/lib/cards";
import {
  Search, Clock, ChevronDown, ChevronLeft, ArrowUpRight,
  X, Edit3, Minus, Receipt, Zap, Check,
  UtensilsCrossed, Car, Home, Plane, ShoppingBag, Heart,
  Gamepad2, Coffee, Sparkles, Gift, Bot, Wrench, Package,
  DollarSign, ArrowLeftRight, Lightbulb,
} from "lucide-react";

// ── Category taxonomy (matches user's budget exactly) ─────────────────────────

export const USER_CATS: Record<string, { emoji: string; sub: string[]; color: string }> = {
  "Food":           { emoji: "🍽️", color: "#f97316", sub: ["Dining Solo", "Dining Group", "Dining Work", "Groceries", "Snacks"] },
  "Drinks":         { emoji: "🍺", color: "#a78bfa", sub: ["Coffee", "Bar / Drinks", "Alcohol", "Non-Alcoholic"] },
  "Housing":        { emoji: "🏠", color: "#6366f1", sub: ["Rent", "Renter's Insurance", "Furniture", "Utilities"] },
  "Transportation": { emoji: "🚗", color: "#3b82f6", sub: ["Gas", "Uber / Lyft", "Divvy / Bike", "Car Insurance", "Car Payment", "Parking"] },
  "Entertainment":  { emoji: "🎮", color: "#ec4899", sub: ["Golf", "Concerts / Events", "Streaming", "Gaming", "Sports"] },
  "Travel":         { emoji: "✈️", color: "#0ea5e9", sub: ["Flights", "Hotels", "Airbnb", "Rental Cars", "Local Transport"] },
  "Personal Care":  { emoji: "💆", color: "#14b8a6", sub: ["Grooming", "Haircuts", "Toiletries"] },
  "Health":         { emoji: "💊", color: "#22c55e", sub: ["Gym", "Health Insurance", "Therapy", "Supplements", "Medical"] },
  "Gifts":          { emoji: "🎁", color: "#f59e0b", sub: ["Birthday", "Holiday", "Wedding", "Flowers"] },
  "AI Spend":       { emoji: "🤖", color: "#8b5cf6", sub: ["ChatGPT / OpenAI", "Claude / Anthropic", "Cursor", "GitHub Copilot", "Perplexity", "Other AI"] },
  "Shopping":       { emoji: "🛍️", color: "#f43f5e", sub: ["Clothing", "Electronics", "Amazon", "Home Goods"] },
  "Services":       { emoji: "⚙️", color: "#64748b", sub: ["Subscriptions", "Professional", "Business"] },
  "Income":         { emoji: "💰", color: "#22c55e", sub: [] },
  "Transfer":       { emoji: "↔️", color: "#94a3b8", sub: [] },
  "Other":          { emoji: "📦", color: "#94a3b8", sub: [] },
};

const ALL_CATS = Object.keys(USER_CATS);

// ── Category icons (no emojis) ────────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

const CAT_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  "Food":           { Icon: UtensilsCrossed, color: "#f97316" },
  "Drinks":         { Icon: Coffee,          color: "#a78bfa" },
  "Housing":        { Icon: Home,            color: "#6366f1" },
  "Transportation": { Icon: Car,             color: "#3b82f6" },
  "Entertainment":  { Icon: Gamepad2,        color: "#ec4899" },
  "Travel":         { Icon: Plane,           color: "#0ea5e9" },
  "Personal Care":  { Icon: Sparkles,        color: "#14b8a6" },
  "Health":         { Icon: Heart,           color: "#22c55e" },
  "Gifts":          { Icon: Gift,            color: "#f59e0b" },
  "AI Spend":       { Icon: Bot,             color: "#8b5cf6" },
  "Shopping":       { Icon: ShoppingBag,     color: "#f43f5e" },
  "Services":       { Icon: Wrench,          color: "#64748b" },
  "Income":         { Icon: DollarSign,      color: "#22c55e" },
  "Transfer":       { Icon: ArrowLeftRight,  color: "#94a3b8" },
  "Other":          { Icon: Package,         color: "#94a3b8" },
};

function CategoryIconBox({ category, isIncoming }: { category: string; isIncoming: boolean }) {
  const def = isIncoming
    ? { Icon: DollarSign, color: "#22c55e" }
    : (CAT_ICON[category] ?? CAT_ICON["Other"]);
  const { Icon, color } = def;
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
      style={{ backgroundColor: color + "15" }}>
      <Icon size={16} style={{ color }} />
    </div>
  );
}

// ── Best card recommendation ──────────────────────────────────────────────────

function getBestCard(userCat: string): { cardId: string; label: string } | null {
  // Returns the card with the highest multiplier for this category
  // Only worth showing if it differs from the used card
  const dining = ["Food", "Drinks"];
  const travel = ["Travel", "Transportation"];
  if (dining.includes(userCat)) return { cardId: "csp", label: "CSP" };  // 3x dining
  if (travel.includes(userCat)) return { cardId: "venture_x", label: "Venture X" }; // 5x+ hotels/cars via portal
  return null; // 1.5x or 2x — CFU / Venture X are both fine
}

// ── AI merchant detection ─────────────────────────────────────────────────────

const AI_MERCHANTS = [
  "openai", "chatgpt", "anthropic", "claude.ai",
  "cursor", "codeium", "github copilot", "copilot",
  "perplexity", "midjourney", "stability", "cohere",
  "jasper", "character.ai", "runway", "elevenlabs",
  "mistral", "groq", "replicate", "together.ai",
];

function detectAI(merchant: string | null): boolean {
  if (!merchant) return false;
  const m = merchant.toLowerCase();
  return AI_MERCHANTS.some((k) => m.includes(k));
}

// Grocery merchant detection
const GROCERY_MERCHANTS = [
  "trader joe", "whole foods", "aldi", "mariano", "jewel", "dominick",
  "kroger", "safeway", "publix", "h-e-b", "meijer", "walmart", "target",
  "costco", "sam's club", "sprouts", "fresh market",
];
const COFFEE_MERCHANTS = ["starbucks", "dunkin", "dutch bros", "caribou", "peet's", "intelligentsia"];
const BAR_MERCHANTS = ["bar ", " bar", "tavern", "pub ", " pub", "brewery", "brewing", "liquor", "binny"];

// Map Plaid's primary category → user's taxonomy
function mapCategory(plaidCat: string | null, merchant: string | null): string {
  const m = (merchant ?? "").toLowerCase();

  // AI Spend detection trumps everything
  if (detectAI(merchant)) return "AI Spend";

  switch (plaidCat) {
    case "FOOD_AND_DRINK": {
      if (GROCERY_MERCHANTS.some((g) => m.includes(g))) return "Food"; // subcategory: Groceries
      if (COFFEE_MERCHANTS.some((c) => m.includes(c))) return "Drinks"; // subcategory: Coffee
      if (BAR_MERCHANTS.some((b) => m.includes(b))) return "Drinks"; // subcategory: Bar
      return "Food"; // default: Dining
    }
    case "TRANSPORTATION":    return "Transportation";
    case "ENTERTAINMENT":     return "Entertainment";
    case "TRAVEL":            return "Travel";
    case "RENT_AND_UTILITIES": return "Housing";
    case "MEDICAL":           return "Health";
    case "PERSONAL_CARE":     return "Personal Care";
    case "GENERAL_MERCHANDISE":
    case "SHOPPING":          return "Shopping";
    case "GENERAL_SERVICES":  return "Services";
    case "INCOME":            return "Income";
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
    case "PAYMENT":           return "Transfer";
    case "LOAN_PAYMENTS":     return "Transfer";
    case "INVESTMENTS":       return "Transfer";
    case "BANK_FEES":         return "Other";
    default:                  return "Other";
  }
}

// ── Points estimation ─────────────────────────────────────────────────────────

// Rough mapping from user category → optimizer category
const CAT_TO_CARD_CAT: Record<string, Parameters<typeof getMultiplier>[1]> = {
  "Food":           "dining",
  "Drinks":         "dining",
  "Travel":         "travel",
  "Transportation": "travel",
  "Entertainment":  "other",
  "Health":         "other",
  "Housing":        "other",
  "Shopping":       "other",
  "Services":       "other",
  "Personal Care":  "other",
  "Gifts":          "other",
  "AI Spend":       "other",
  "Other":          "other",
};

// Guess card ID from account name fragment
function guessCardId(name: string | null): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("freedom unlimited") || n.includes("freedom un")) return "cfu";
  if (n.includes("sapphire preferred")) return "csp";
  if (n.includes("boundless") || (n.includes("marriott") && n.includes("chase"))) return "boundless";
  if (n.includes("venture x")) return "venture_x";
  if (n.includes("venture") && !n.includes("x")) return "venture_x";
  if (n.includes("capital one")) return "venture_x";
  if (n.includes("chase") && n.includes("credit")) return "cfu";
  return null;
}

function estimatePoints(amount: number, cardId: string | null, userCat: string): number {
  if (!cardId || amount <= 0) return 0;
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) return 0;
  const cardCat = CAT_TO_CARD_CAT[userCat] ?? "other";
  const { multiplier } = getMultiplier(card, cardCat);
  return Math.round(amount * multiplier);
}

function ptsValue(pts: number, cardId: string | null): number {
  if (!cardId) return 0;
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) return 0;
  return (pts * CPP[card.pointsProgram]) / 100;
}

// ── LocalStorage persistence for overrides ────────────────────────────────────

const LS_KEY = "tx_overrides_v2";

interface TxOverride {
  category?: string;      // user's custom category
  subcategory?: string;
  reimbursement?: number; // $ received back (Venmo etc.)
}

function loadOverrides(): Map<string, TxOverride> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch { return new Map(); }
}

function saveOverrides(m: Map<string, TxOverride>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify([...m.entries()]));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  plaid_tx_id: string;
  plaid_account_id: string;
  posted_at: string;
  amount: number;
  merchant_raw: string | null;
  category: string | null;
  pending: boolean | null;
}

type ViewMode = "spend" | "budget";

// ── Recategorize modal ────────────────────────────────────────────────────────

function RecategorizeModal({
  tx,
  current,
  onSave,
  onClose,
}: {
  tx: Transaction;
  current: TxOverride;
  onSave: (o: TxOverride) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState(current.category ?? mapCategory(tx.category, tx.merchant_raw));
  const [sub, setSub] = useState(current.subcategory ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Recategorize</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs">{tx.merchant_raw ?? "Unknown"}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <X size={13} className="text-muted-foreground" />
          </button>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-3 gap-2">
          {ALL_CATS.filter((c) => c !== "Income" && c !== "Transfer").map((c) => {
            const info = USER_CATS[c];
            return (
              <button key={c} onClick={() => { setCat(c); setSub(""); }}
                className={`flex flex-col items-center gap-1 rounded-xl p-2.5 border text-center transition-colors ${
                  cat === c ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:bg-muted/50"
                }`}>
                <span className="text-lg">{info.emoji}</span>
                <span className="text-[10px] font-semibold text-foreground leading-tight">{c}</span>
              </button>
            );
          })}
        </div>

        {/* Subcategory */}
        {USER_CATS[cat]?.sub.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Subcategory (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {USER_CATS[cat].sub.map((s) => (
                <button key={s} onClick={() => setSub(sub === s ? "" : s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    sub === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
            Cancel
          </button>
          <button onClick={() => { onSave({ ...current, category: cat, subcategory: sub || undefined }); onClose(); }}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reimbursement modal ───────────────────────────────────────────────────────

function ReimburseModal({
  tx,
  current,
  onSave,
  onClose,
}: {
  tx: Transaction;
  current: TxOverride;
  onSave: (o: TxOverride) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState((current.reimbursement ?? "").toString());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Venmo / Reimbursement</p>
            <p className="text-[11px] text-muted-foreground">
              Full charge: ${Math.abs(tx.amount).toFixed(2)} — how much did you get back?
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <X size={13} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Amount reimbursed ($)</label>
          <input type="number" value={val} onChange={(e) => setVal(e.target.value)} autoFocus
            placeholder="0.00"
            className="w-full rounded-xl border border-border bg-background text-xl font-bold text-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {val && !isNaN(parseFloat(val)) && parseFloat(val) > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Net expense: <span className="font-bold text-foreground">
                ${Math.max(0, tx.amount - parseFloat(val)).toFixed(2)}
              </span>
              {" · Points still calculated on full ${Math.abs(tx.amount).toFixed(2)}"}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {current.reimbursement && (
            <button onClick={() => { onSave({ ...current, reimbursement: undefined }); onClose(); }}
              className="px-4 rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive">
              Clear
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
            Cancel
          </button>
          <button onClick={() => {
            const n = parseFloat(val);
            onSave({ ...current, reimbursement: isNaN(n) || n <= 0 ? undefined : n });
            onClose();
          }} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({
  tx,
  viewMode,
  accountName,
  cardId,
  override,
  onRecategorize,
  onReimburse,
}: {
  tx: Transaction;
  viewMode: ViewMode;
  accountName: string;
  cardId: string | null;
  override: TxOverride;
  onRecategorize: () => void;
  onReimburse: () => void;
}) {
  const isIncoming = tx.amount < 0;
  const rawAmt = Math.abs(tx.amount);
  const cat = override.category ?? mapCategory(tx.category, tx.merchant_raw);
  const catInfo = USER_CATS[cat] ?? USER_CATS["Other"];
  const reimb = override.reimbursement ?? 0;
  const netAmt = Math.max(0, rawAmt - reimb);

  // Points only on outgoing credit transactions
  const showPoints = viewMode === "spend" && !isIncoming && tx.amount > 0;
  const pts = showPoints ? estimatePoints(rawAmt, cardId, cat) : 0;
  const ptsDollarVal = ptsValue(pts, cardId);

  const isTransfer = cat === "Transfer" || cat === "Income";

  // In budget mode, skip pure incoming transfers (but show reimbursements in context)
  if (viewMode === "budget" && isIncoming && isTransfer) return null;
  // In spend mode, skip incoming
  if (viewMode === "spend" && isIncoming) return null;
  // Skip zero-amount
  if (tx.amount === 0) return null;

  // Card recommendation — only show in spend mode for outgoing credit transactions
  const bestCard = (viewMode === "spend" && !isIncoming && cardId)
    ? getBestCard(cat)
    : null;
  const showRec = bestCard && bestCard.cardId !== cardId;

  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-border/40 last:border-0">
      {/* Category icon — no emojis */}
      <CategoryIconBox category={cat} isIncoming={isIncoming} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {tx.merchant_raw ?? "Unknown"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {/* Category badge — tappable */}
              <button onClick={onRecategorize}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors hover:border-primary/40"
                style={{ borderColor: catInfo.color + "40", color: catInfo.color, backgroundColor: catInfo.color + "10" }}>
                {cat}
                {override.subcategory && <span className="opacity-70">· {override.subcategory}</span>}
                <Edit3 size={8} className="opacity-60" />
              </button>
              {override.category && (
                <span className="text-[9px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full">custom</span>
              )}
              {tx.pending && (
                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  <Clock size={8} />pending
                </span>
              )}
              <span className="text-[10px] text-muted-foreground truncate">{accountName}</span>
            </div>

            {/* Points row (All Spend mode) */}
            {showPoints && pts > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Zap size={10} className="text-primary" />
                <span className="text-[10px] font-semibold text-primary">
                  +{pts.toLocaleString()} pts
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · ~${ptsDollarVal.toFixed(2)} value
                </span>
              </div>
            )}

            {/* Card recommendation */}
            {showRec && (
              <div className="flex items-center gap-1 mt-1">
                <Lightbulb size={10} className="text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Use {bestCard!.label} here for more points
                </span>
              </div>
            )}

            {/* Reimbursement row (Budget mode) */}
            {viewMode === "budget" && !isIncoming && !isTransfer && (
              <button onClick={onReimburse}
                className={`flex items-center gap-1 mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 transition-colors ${
                  reimb > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}>
                {reimb > 0 ? (
                  <><Check size={9} />Reimbursed ${reimb.toFixed(2)} · net ${netAmt.toFixed(2)}</>
                ) : (
                  <><Minus size={9} />Got Venmo back?</>
                )}
              </button>
            )}
          </div>

          {/* Amount */}
          <div className="text-right shrink-0">
            {viewMode === "budget" && reimb > 0 && !isIncoming ? (
              <>
                <p className="text-xs text-muted-foreground line-through">${rawAmt.toFixed(2)}</p>
                <p className="text-sm font-bold text-foreground">${netAmt.toFixed(2)}</p>
              </>
            ) : (
              <p className={`text-sm font-semibold ${isIncoming ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                {isIncoming ? "+" : "-"}${rawAmt.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 60;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<{ plaid_account_id: string; name: string | null; mask: string | null; item_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterAccountId, setFilterAccountId] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("spend");
  const [overrides, setOverrides] = useState<Map<string, TxOverride>>(new Map());
  const [recatTx, setRecatTx] = useState<Transaction | null>(null);
  const [reimburseTx, setReimburseTx] = useState<Transaction | null>(null);
  const cardNameMap = useCardNameMap();

  // Load overrides from localStorage
  useEffect(() => { setOverrides(loadOverrides()); }, []);

  // Persist overrides
  useEffect(() => { saveOverrides(overrides); }, [overrides]);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [{ data: txs }, { data: accts }] = await Promise.all([
          supabase
            .from("transactions")
            .select("plaid_tx_id, plaid_account_id, posted_at, amount, merchant_raw, category, pending")
            .order("posted_at", { ascending: false })
            .limit(500),
          supabase
            .from("card_balances")
            .select("plaid_account_id, name, mask, item_id"),
        ]);
        if (txs) setTransactions(txs);
        if (accts) setAccounts(accts);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Account label map
  const accountMap = useMemo(() => {
    return new Map(
      accounts.map((a) => {
        const friendly = (a.mask && cardNameMap.has(a.mask))
          ? cardNameMap.get(a.mask)!
          : (a.name ?? "Account");
        return [a.plaid_account_id, { label: friendly, cardId: guessCardId(a.name) }];
      })
    );
  }, [accounts, cardNameMap]);

  const updateOverride = useCallback((txId: string, patch: TxOverride) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(txId, { ...(prev.get(txId) ?? {}), ...patch });
      return next;
    });
  }, []);

  // Filtered transactions
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const override = overrides.get(tx.plaid_tx_id) ?? {};
      const cat = override.category ?? mapCategory(tx.category, tx.merchant_raw);

      // View mode filtering
      if (viewMode === "spend" && tx.amount <= 0) return false; // hide incoming
      if (viewMode === "spend" && (cat === "Transfer" || cat === "Income")) return false;
      if (viewMode === "budget" && tx.amount < 0 && (cat === "Transfer" || cat === "Income")) return false;
      if (tx.amount === 0) return false;

      // Category filter
      if (filterCat !== "all" && cat !== filterCat) return false;
      // Account filter
      if (filterAccountId !== "all" && tx.plaid_account_id !== filterAccountId) return false;
      // Search
      if (q) {
        const m = (tx.merchant_raw ?? "").toLowerCase().includes(q);
        const c = cat.toLowerCase().includes(q);
        if (!m && !c) return false;
      }
      return true;
    });
  }, [transactions, overrides, viewMode, filterCat, filterAccountId, search]);

  // Summary stats for current view
  const stats = useMemo(() => {
    let totalSpend = 0, totalNet = 0, totalPts = 0;
    for (const tx of filtered) {
      if (tx.amount <= 0) continue;
      const override = overrides.get(tx.plaid_tx_id) ?? {};
      const cat = override.category ?? mapCategory(tx.category, tx.merchant_raw);
      const acct = accountMap.get(tx.plaid_account_id);
      const reimb = override.reimbursement ?? 0;
      totalSpend += tx.amount;
      totalNet += Math.max(0, tx.amount - reimb);
      totalPts += estimatePoints(tx.amount, acct?.cardId ?? null, cat);
    }
    return { totalSpend, totalNet, totalPts };
  }, [filtered, overrides, accountMap]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; txs: Transaction[] }[] = [];
    let currentDate = "";
    for (const tx of filtered.slice(0, visibleCount)) {
      if (tx.posted_at !== currentDate) {
        currentDate = tx.posted_at;
        groups.push({ label: formatDateLabel(tx.posted_at), txs: [] });
      }
      groups[groups.length - 1].txs.push(tx);
    }
    return groups;
  }, [filtered, visibleCount]);

  // Category filter options (only show cats present in current tx set)
  const availableCats = useMemo(() => {
    const present = new Set<string>();
    for (const tx of transactions) {
      if (tx.amount <= 0) continue;
      const override = overrides.get(tx.plaid_tx_id) ?? {};
      present.add(override.category ?? mapCategory(tx.category, tx.merchant_raw));
    }
    return ALL_CATS.filter((c) => present.has(c));
  }, [transactions, overrides]);

  // Account options
  const accountOptions = useMemo(() =>
    accounts.map((a) => ({
      id: a.plaid_account_id,
      label: accountMap.get(a.plaid_account_id)?.label ?? "Account",
    })), [accounts, accountMap]);

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground mb-3 -ml-0.5 w-fit">
          <ChevronLeft size={16} />Back
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">All accounts · your taxonomy</p>
      </div>

      {/* View mode toggle */}
      <div className="px-4 mb-3">
        <div className="flex rounded-2xl border border-border bg-muted/50 p-1 gap-1">
          <button onClick={() => { setViewMode("spend"); setVisibleCount(PAGE_SIZE); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              viewMode === "spend" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Zap size={12} />All Spend · Points
          </button>
          <button onClick={() => { setViewMode("budget"); setVisibleCount(PAGE_SIZE); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              viewMode === "budget" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Receipt size={12} />Budget · Net
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
          {viewMode === "spend"
            ? "Full purchase amounts — used for points calculation. Tap a category badge to recategorize."
            : "Actual out-of-pocket cost. Tap 'Got Venmo back?' to net out group dinner reimbursements."}
        </p>
      </div>

      {/* Stats strip */}
      {!loading && filtered.length > 0 && (
        <div className="px-4 mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-card px-2.5 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">{viewMode === "budget" ? "Net Spend" : "Total Spend"}</p>
            <p className="text-sm font-bold text-foreground">
              ${(viewMode === "budget" ? stats.totalNet : stats.totalSpend).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>
          {viewMode === "spend" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Est. Points</p>
              <p className="text-sm font-bold text-primary">
                {stats.totalPts.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
          {viewMode === "budget" && stats.totalSpend > stats.totalNet && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Reimbursed</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ${(stats.totalSpend - stats.totalNet).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card px-2.5 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">Transactions</p>
            <p className="text-sm font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 flex flex-col gap-2 mb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Search merchants…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Category filter chips */}
      {availableCats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-1 px-4 scrollbar-hide">
          <button onClick={() => setFilterCat("all")}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filterCat === "all" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
            }`}>
            All
          </button>
          {availableCats.map((c) => {
            const info = USER_CATS[c];
            return (
              <button key={c} onClick={() => setFilterCat(filterCat === c ? "all" : c)}
                className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filterCat === c ? "text-white border-transparent" : "border-border text-muted-foreground"
                }`}
                style={filterCat === c ? { backgroundColor: info.color } : {}}>
                {info.emoji} {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Account filter */}
      {accountOptions.length > 1 && (
        <div className="px-4 mb-3 relative">
          <select value={filterAccountId}
            onChange={(e) => { setFilterAccountId(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className="w-full appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none">
            <option value="all">All accounts</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="flex flex-col gap-0 mx-4 rounded-2xl border border-border overflow-hidden animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/40 border-b border-border/40 last:border-0" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="px-4">
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ArrowUpRight size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your accounts in <span className="text-primary font-medium">Settings → Connected Accounts</span>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-0 mx-4 rounded-2xl border border-border overflow-hidden">
          {grouped.map(({ label, txs }) => (
            <div key={label}>
              <div className="px-4 py-2 bg-muted/40 border-b border-border/40">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
              {txs.map((tx) => {
                const acct = accountMap.get(tx.plaid_account_id);
                const override = overrides.get(tx.plaid_tx_id) ?? {};
                return (
                  <TxRow
                    key={tx.plaid_tx_id}
                    tx={tx}
                    viewMode={viewMode}
                    accountName={acct?.label ?? "Account"}
                    cardId={acct?.cardId ?? null}
                    override={override}
                    onRecategorize={() => setRecatTx(tx)}
                    onReimburse={() => setReimburseTx(tx)}
                  />
                );
              })}
            </div>
          ))}
          {filtered.length > visibleCount && (
            <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full py-3 text-sm font-semibold text-primary border-t border-border hover:bg-muted/30 transition-colors">
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {recatTx && (
        <RecategorizeModal
          tx={recatTx}
          current={overrides.get(recatTx.plaid_tx_id) ?? {}}
          onSave={(o) => updateOverride(recatTx.plaid_tx_id, o)}
          onClose={() => setRecatTx(null)}
        />
      )}
      {reimburseTx && (
        <ReimburseModal
          tx={reimburseTx}
          current={overrides.get(reimburseTx.plaid_tx_id) ?? {}}
          onSave={(o) => updateOverride(reimburseTx.plaid_tx_id, o)}
          onClose={() => setReimburseTx(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
