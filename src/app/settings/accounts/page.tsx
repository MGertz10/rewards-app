"use client";

import { useState, useCallback, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { usePlaidLink } from "react-plaid-link";
import { Link2Off, CheckCircle2, Loader2, RefreshCw, Plus, Pencil, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCardNameMap, resolveAccountName } from "@/lib/use-card-name-map";

// ── Plaid logo ────────────────────────────────────────────────────────────────

function PlaidLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#117ACA" fillOpacity="0.15" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="#117ACA" />
      <rect x="18" y="6" width="8" height="8" rx="1" fill="#117ACA" fillOpacity="0.6" />
      <rect x="6" y="18" width="8" height="8" rx="1" fill="#117ACA" fillOpacity="0.6" />
      <rect x="18" y="18" width="8" height="8" rx="1" fill="#117ACA" fillOpacity="0.3" />
    </svg>
  );
}

function SheetsLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#22C55E" fillOpacity="0.15" />
      <rect x="7" y="9" width="18" height="2" rx="1" fill="#22C55E" />
      <rect x="7" y="13" width="18" height="2" rx="1" fill="#22C55E" fillOpacity="0.7" />
      <rect x="7" y="17" width="12" height="2" rx="1" fill="#22C55E" fillOpacity="0.5" />
      <rect x="7" y="21" width="8" height="2" rx="1" fill="#22C55E" fillOpacity="0.3" />
    </svg>
  );
}

// ── Plaid Link widget ─────────────────────────────────────────────────────────

const LINK_TOKEN_KEY = "plaid_link_token";

function PlaidConnectButton({
  onSuccess,
  disabled,
  variant = "primary",
}: {
  onSuccess: () => void;
  disabled?: boolean;
  variant?: "primary" | "add-another";
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [errorDetails, setErrorDetails] = useState<string>("");

  // Detect OAuth return: Chase/Cap One redirect back with ?oauth_state_id=...
  const isOAuthReturn =
    typeof window !== "undefined" &&
    window.location.href.includes("oauth_state_id");

  const receivedRedirectUri = isOAuthReturn ? window.location.href : undefined;

  useEffect(() => {
    if (isOAuthReturn) {
      // Restore the link token we saved before the OAuth redirect
      const saved = sessionStorage.getItem(LINK_TOKEN_KEY);
      if (saved) setLinkToken(saved);
      else setStatus("error"); // token expired — user must retry
      return;
    }
    // Normal flow: fetch a fresh link token
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        const token = d.link_token ?? null;
        if (!token) { setStatus("error"); return; }
        setLinkToken(token);
        sessionStorage.setItem(LINK_TOKEN_KEY, token);
      })
      .catch(() => setStatus("error"));
  }, [isOAuthReturn]);

  const onPlaidSuccess = useCallback(
    async (public_token: string, metadata: { institution?: { name?: string } | null }) => {
      setStatus("connecting");
      sessionStorage.removeItem(LINK_TOKEN_KEY);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution_name: metadata?.institution?.name ?? "Unknown",
          }),
        });
        if (!res.ok) throw new Error("Exchange failed");
        setStatus("success");
        onSuccess();
      } catch {
        setStatus("error");
      }
    },
    [onSuccess]
  );

  const onPlaidExit = useCallback((err: unknown, metadata: unknown) => {
    const details = `err=${JSON.stringify(err)} | meta=${JSON.stringify(metadata)}`;
    console.error("[plaid] onExit", details);
    setErrorDetails(details);
    if (err) setStatus("error");
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
    ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
  });

  // Auto-open on OAuth return once ready
  useEffect(() => {
    if (isOAuthReturn && ready) open();
  }, [isOAuthReturn, ready, open]);

  if (status === "success") {
    return (
      <button
        disabled
        className="w-full rounded-xl bg-success/10 text-success py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={15} />
        Connected — syncing accounts…
      </button>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-destructive text-center">
          Connection failed. Try refreshing the page.
        </p>
        {errorDetails && (
          <pre className="text-[10px] bg-muted p-2 rounded-lg overflow-auto whitespace-pre-wrap break-all border border-border">
            {errorDetails}
          </pre>
        )}
      </div>
    );
  }

  const isAddAnother = variant === "add-another";
  const buttonClass = isAddAnother
    ? "w-full rounded-xl bg-muted/60 text-foreground border border-dashed border-border py-2.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    : "w-full rounded-xl bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2";
  const idleLabel = isAddAnother ? "+ Add another bank" : "Connect with Plaid";

  return (
    <button
      onClick={() => open()}
      disabled={disabled || !ready || !linkToken || status === "connecting"}
      className={buttonClass}
    >
      {status === "connecting" || !linkToken ? (
        <Loader2 size={15} className="animate-spin" />
      ) : isAddAnother ? null : (
        <PlaidLogo />
      )}
      {status === "connecting" ? "Connecting…" : !linkToken ? "Loading…" : idleLabel}
    </button>
  );
}

// ── Plaid Investment re-link button ──────────────────────────────────────────
// Uses /api/plaid/link-token/investments (Products.Investments) so existing
// bank/card link tokens are never broken by the Investments product requirement.

function PlaidInvestmentButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token) => {
      await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      onSuccess();
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token/investments", { method: "POST" });
      const { link_token } = await res.json();
      if (link_token) setLinkToken(link_token);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || (!!linkToken && !ready)}
      className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-60 flex items-center gap-1"
    >
      {loading && <Loader2 size={10} className="animate-spin" />}
      Re-link
    </button>
  );
}

// ── Connected institutions list ───────────────────────────────────────────────

interface PlaidItem {
  item_id: string;
  institution: string;
  updated_at: string;
}

interface PlaidAccount {
  plaid_account_id: string;
  item_id: string;
  name: string | null;
  mask: string | null;
  account_type: string | null;
}

function ConnectedSection({
  items,
  accounts,
  syncing,
  lastSync,
  cardNameMap,
  syncErrors,
  onSync,
  onDisconnect,
  onClearAll,
}: {
  items: PlaidItem[];
  accounts: PlaidAccount[];
  syncing: boolean;
  lastSync: string | null;
  cardNameMap: Map<string, string>;
  syncErrors: Record<string, string>;
  onSync: () => void;
  onDisconnect: (id: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Institution cards with nested accounts */}
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const added = new Date(item.updated_at);
          const addedLabel = added.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const itemAccounts = accounts.filter((a) => a.item_id === item.item_id);
          return (
            <div
              key={item.item_id}
              className="rounded-xl bg-muted/60 border border-border overflow-hidden"
            >
              {/* Institution header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={13} className="text-success shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {item.institution}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Connected {addedLabel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onDisconnect(item.item_id)}
                  className="text-[11px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1 shrink-0"
                >
                  <Link2Off size={11} />
                  Remove
                </button>
              </div>
              {/* Re-link prompt for any institution that has investment-type accounts */}
              {itemAccounts.some((a) => a.account_type === "investment" || a.account_type === "brokerage" || a.account_type === "ira" || a.account_type === "retirement") && (
                <div className="px-3 py-1.5 bg-primary/5 border-b border-border/40 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">Re-link to sync fund-level holdings</p>
                  <PlaidInvestmentButton onSuccess={() => window.location.reload()} />
                </div>
              )}

              {/* Nested accounts */}
              {itemAccounts.length > 0 ? (
                <div className="flex flex-col">
                  {itemAccounts.map((acc) => (
                    <div
                      key={acc.plaid_account_id}
                      className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                    >
                      <span className="text-foreground truncate">
                        {resolveAccountName(acc.mask, acc.name, cardNameMap)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : syncErrors[item.item_id] ? (
                <p className="px-3 py-2 text-[10px] text-destructive font-mono break-all">
                  Sync error: {syncErrors[item.item_id]}
                </p>
              ) : (
                <p className="px-3 py-1.5 text-[11px] text-muted-foreground italic">
                  Accounts will appear after first sync
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onSync}
        disabled={syncing}
        className="w-full rounded-xl bg-primary/10 text-primary border border-primary/20 py-2.5 text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Refresh Now"}
      </button>
      {lastSync && (
        <p className="text-[11px] text-muted-foreground text-center">
          Last synced at {lastSync}
        </p>
      )}

      {/* Nuclear option — clears all synced Plaid data */}
      <button
        onClick={onClearAll}
        className="w-full text-[11px] text-destructive/60 hover:text-destructive transition-colors py-1 text-center"
      >
        Clear all synced account data
      </button>
    </div>
  );
}

// ── Manual Accounts ───────────────────────────────────────────────────────────

interface ManualAccount {
  id: string;
  name: string;
  institution: string;
  account_type: string;
  balance: number;
  notes: string | null;
  updated_at: string;
}

const ACCOUNT_TYPES = [
  { value: "checking",   label: "Checking",    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { value: "savings",    label: "Savings",     color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  { value: "investment", label: "Investment",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { value: "retirement", label: "Retirement",  color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "hsa",        label: "HSA",         color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { value: "loan",       label: "Loan / Debt", color: "bg-destructive/10 text-destructive" },
  { value: "other",      label: "Other",       color: "bg-muted text-muted-foreground" },
] as const;

function typeConfig(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Manual Holdings ───────────────────────────────────────────────────────────

interface ManualHolding {
  id: string;
  account_id: string;
  ticker: string;
  name: string | null;
  shares: number;
  cost_basis_per_share: number | null;
  asset_class: string;
}

const ASSET_CLASSES = [
  { value: "equity",  label: "Stock" },
  { value: "fund",    label: "Fund / ETF" },
  { value: "bond",    label: "Bond" },
  { value: "cash",    label: "Cash" },
  { value: "crypto",  label: "Crypto" },
  { value: "other",   label: "Other" },
] as const;

function HoldingForm({
  accountId,
  initial,
  onSave,
  onCancel,
}: {
  accountId: string;
  initial?: Partial<ManualHolding>;
  onSave: (h: ManualHolding) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [shares, setShares] = useState(initial?.shares?.toString() ?? "");
  const [costBasis, setCostBasis] = useState(initial?.cost_basis_per_share?.toString() ?? "");
  const [assetClass, setAssetClass] = useState(initial?.asset_class ?? "equity");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  async function handleSubmit() {
    if (!ticker.trim() || !shares) return;
    setSaving(true);
    try {
      const res = await fetch("/api/accounts/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(initial?.id ? { id: initial.id } : {}),
          account_id: accountId,
          ticker: ticker.trim().toUpperCase(),
          name: name.trim() || null,
          shares: parseFloat(shares) || 0,
          cost_basis_per_share: costBasis ? parseFloat(costBasis) : null,
          asset_class: assetClass,
        }),
      });
      const { data } = await res.json();
      if (data) onSave(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 border border-border mt-1">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker (e.g. FXAIX)"
          className={inputClass}
        />
        <input
          type="number"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="Shares"
          className={inputClass}
        />
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional, e.g. Fidelity 500 Index)"
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)} className={inputClass}>
          {ASSET_CLASSES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="Cost basis/share"
            className={`${inputClass} pl-7`}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!ticker.trim() || !shares || saving}
          className="flex-1 rounded-xl bg-primary text-white py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial?.id ? "Save" : "Add Holding"}
        </button>
        <button onClick={onCancel} className="px-4 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function HoldingsPanel({ accountId }: { accountId: string }) {
  const [holdings, setHoldings] = useState<ManualHolding[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadHoldings() {
    const res = await fetch(`/api/accounts/holdings?account_id=${accountId}`);
    const { data } = await res.json();
    const loaded: ManualHolding[] = data ?? [];
    setHoldings(loaded);
    setLoading(false);

    // Fetch live prices for all tickers
    const tickers = loaded.map((h) => h.ticker).filter(Boolean);
    if (tickers.length > 0) {
      const pRes = await fetch(`/api/prices?tickers=${tickers.join(",")}`);
      const { prices: p } = await pRes.json();
      setPrices(p ?? {});
    }
  }

  useEffect(() => { loadHoldings(); }, [accountId]);

  async function handleDelete(id: string) {
    await fetch(`/api/accounts/holdings?id=${id}`, { method: "DELETE" });
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  const totalValue = holdings.reduce((sum, h) => {
    const price = prices[h.ticker];
    return sum + (price != null ? price * h.shares : 0);
  }, 0);

  if (loading) return <div className="py-2 flex justify-center"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {holdings.length > 0 && (
        <div className="flex flex-col divide-y divide-border/40">
          {holdings.map((h) =>
            editingId === h.id ? (
              <HoldingForm
                key={h.id}
                accountId={accountId}
                initial={h}
                onSave={(updated) => { setHoldings((prev) => prev.map((x) => x.id === updated.id ? updated : x)); setEditingId(null); loadHoldings(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <HoldingRow
                key={h.id}
                holding={h}
                price={prices[h.ticker] ?? null}
                onEdit={() => setEditingId(h.id)}
                onDelete={() => handleDelete(h.id)}
              />
            )
          )}
        </div>
      )}

      {holdings.length > 0 && (
        <div className="flex items-center justify-between px-1 pt-1 border-t border-border/40">
          <span className="text-[10px] text-muted-foreground">Total (priced positions)</span>
          <span className="text-xs font-bold text-foreground">${fmt(totalValue)}</span>
        </div>
      )}

      {addingNew ? (
        <HoldingForm
          accountId={accountId}
          onSave={(h) => { setHoldings((prev) => [...prev, h]); setAddingNew(false); loadHoldings(); }}
          onCancel={() => setAddingNew(false)}
        />
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs text-primary font-medium py-1.5 hover:underline"
        >
          <Plus size={12} />
          Add holding
        </button>
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  price,
  onEdit,
  onDelete,
}: {
  holding: ManualHolding;
  price: number | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const value = price != null ? price * holding.shares : null;
  const costTotal = holding.cost_basis_per_share != null ? holding.cost_basis_per_share * holding.shares : null;
  const gain = value != null && costTotal != null ? value - costTotal : null;
  const gainPct = gain != null && costTotal && costTotal > 0 ? (gain / costTotal) * 100 : null;

  return (
    <div className="flex items-center gap-2 py-1.5 first:pt-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground font-mono">{holding.ticker}</span>
          {holding.name && <span className="text-[10px] text-muted-foreground truncate">{holding.name}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{holding.shares} shares</span>
          {price != null && (
            <span className="text-[10px] text-muted-foreground">@ ${price.toFixed(2)}</span>
          )}
          {gainPct != null && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${gain! >= 0 ? "text-success" : "text-destructive"}`}>
              {gain! >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {gain! >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {value != null ? (
          <span className="text-xs font-bold text-foreground">${fmt(value)}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">no price</span>
        )}
      </div>
      <button onClick={onEdit} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <Pencil size={11} />
      </button>
      <button onClick={onDelete} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function ManualAccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<ManualAccount>;
  onSave: (data: Partial<ManualAccount>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [accountType, setAccountType] = useState(initial?.account_type ?? "other");
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || balance === "") return;
    setSaving(true);
    await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      institution: institution.trim(),
      account_type: accountType,
      balance: parseFloat(balance) || 0,
    });
    setSaving(false);
  }

  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-muted/50 border border-border">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Account name (e.g. Fidelity Roth IRA)"
        className={inputClass}
      />
      <input
        value={institution}
        onChange={(e) => setInstitution(e.target.value)}
        placeholder="Institution (e.g. Fidelity)"
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          className={inputClass}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
            className={`${inputClass} pl-7`}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || balance === "" || saving}
          className="flex-1 rounded-xl bg-primary text-white py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial?.id ? "Save Changes" : "Add Account"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ManualAccountsSection({
  accounts,
  onAdd,
  onEdit,
  onDelete,
}: {
  accounts: ManualAccount[];
  onAdd: (data: Partial<ManualAccount>) => Promise<void>;
  onEdit: (data: Partial<ManualAccount>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedHoldings, setExpandedHoldings] = useState<Set<string>>(new Set());

  function toggleHoldings(id: string) {
    setExpandedHoldings((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const investmentTypes = new Set(["investment", "retirement", "hsa"]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Manual Accounts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fidelity, UBS, Inspira HSA — update balances monthly
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-accent px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <Plus size={13} />
            Add
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <ManualAccountForm
          onSave={async (data) => { await onAdd(data); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Account list */}
      {accounts.length > 0 ? (
        <div className="flex flex-col divide-y divide-border/60">
          {accounts.map((acct) => {
            const tc = typeConfig(acct.account_type);
            const isDebt = acct.account_type === "loan";
            return (
              <div key={acct.id}>
                {editingId === acct.id ? (
                  <div className="py-2">
                    <ManualAccountForm
                      initial={acct}
                      onSave={async (data) => { await onEdit(data); setEditingId(null); }}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{acct.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${tc.color}`}>
                            {tc.label}
                          </span>
                        </div>
                        {acct.institution && (
                          <p className="text-xs text-muted-foreground">{acct.institution}</p>
                        )}
                      </div>
                      <p className={`text-sm font-bold shrink-0 ${isDebt ? "text-destructive" : "text-foreground"}`}>
                        {isDebt ? "-" : ""}${fmt(acct.balance)}
                      </p>
                      {investmentTypes.has(acct.account_type) && (
                        <button
                          onClick={() => toggleHoldings(acct.id)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
                          title="View holdings"
                        >
                          {expandedHoldings.has(acct.id) ? <ChevronUp size={13} /> : <BarChart2 size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingId(acct.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(acct.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {expandedHoldings.has(acct.id) && (
                      <div className="ml-1 mt-1 pl-3 border-l-2 border-primary/20">
                        <HoldingsPanel accountId={acct.id} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm ? (
        <p className="text-xs text-muted-foreground italic text-center py-2">
          No manual accounts yet. Add Fidelity, UBS, Inspira HSA, etc.
        </p>
      ) : null}

      {accounts.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Tap the pencil icon to update a balance anytime
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccount[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>([]);
  const cardNameMap = useCardNameMap();

  // Load Plaid connections + manual accounts on mount
  useEffect(() => {
    async function loadAll() {
      try {
        const supabase = createClient();
        const [{ data: items }, { data: accounts }, manualRes] = await Promise.all([
          supabase
            .from("plaid_items")
            .select("item_id, institution, updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("card_balances")
            .select("plaid_account_id, item_id, name, mask, account_type"),
          fetch("/api/accounts/manual").then((r) => r.json()),
        ]);
        if (items) setPlaidItems(items);
        if (accounts) setPlaidAccounts(accounts);
        if (manualRes?.data) setManualAccounts(manualRes.data);
      } finally {
        setLoadingItems(false);
      }
    }
    loadAll();
  }, []);

  async function handleAddManual(data: Partial<ManualAccount>) {
    const res = await fetch("/api/accounts/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { data: saved } = await res.json();
    if (saved) setManualAccounts((prev) => [...prev, saved]);
  }

  async function handleEditManual(data: Partial<ManualAccount>) {
    const res = await fetch("/api/accounts/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { data: saved } = await res.json();
    if (saved) setManualAccounts((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
  }

  async function handleDeleteManual(id: string) {
    await fetch(`/api/accounts/manual?id=${id}`, { method: "DELETE" });
    setManualAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleManualSync() {
    setSyncing(true);
    setSyncErrors({});
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setLastSync(new Date().toLocaleTimeString());

      // Surface per-item errors so the user can see what failed
      if (json.results) {
        const errs: Record<string, string> = {};
        for (const r of json.results as { item_id: string; accounts: number; error?: string }[]) {
          if (r.error) errs[r.item_id] = r.error;
        }
        setSyncErrors(errs);
      }

      // Reload account list to pick up newly synced accounts
      const supabase = createClient();
      const { data: accts } = await supabase
        .from("card_balances")
        .select("plaid_account_id, item_id, name, mask, account_type");
      if (accts) setPlaidAccounts(accts);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(itemId: string) {
    const supabase = createClient();
    // Explicitly delete child records (cascade should handle it but belt-and-suspenders)
    await Promise.all([
      supabase.from("card_balances").delete().eq("item_id", itemId),
      supabase.from("transactions").delete().eq("item_id", itemId),
    ]);
    await supabase.from("plaid_items").delete().eq("item_id", itemId);
    setPlaidItems((prev) => prev.filter((i) => i.item_id !== itemId));
    setPlaidAccounts((prev) => prev.filter((a) => a.item_id !== itemId));
  }

  async function handleClearAllPlaidData() {
    if (!confirm("This will remove all connected accounts and synced data. Are you sure?")) return;
    const supabase = createClient();
    // Delete all rows from each table — the filters match every non-empty row
    await Promise.all([
      supabase.from("card_balances").delete().neq("plaid_account_id", "__none__"),
      supabase.from("transactions").delete().neq("plaid_tx_id", "__none__"),
      supabase.from("plaid_items").delete().neq("item_id", "__none__"),
    ]);
    setPlaidItems([]);
    setPlaidAccounts([]);
  }

  async function handleConnectSuccess() {
    const supabase = createClient();
    const [{ data: items }, { data: accounts }] = await Promise.all([
      supabase
        .from("plaid_items")
        .select("item_id, institution, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("card_balances")
        .select("plaid_account_id, item_id, name, mask, account_type"),
    ]);
    if (items) setPlaidItems(items);
    if (accounts) setPlaidAccounts(accounts);
  }

  const plaidConnected = plaidItems.length > 0;

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Connected Accounts" />

      <div className="px-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground px-1">
          Connect your accounts to power the Dashboard. All connections are read-only — we never store account numbers or routing numbers.
        </p>

        {/* ── Plaid ── */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <PlaidLogo />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Plaid</p>
                {plaidConnected && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 size={10} />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Securely link your bank and credit card accounts
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">What this unlocks:</p>
            <ul className="flex flex-col gap-1">
              {[
                "Live card balances and utilization on the Dashboard",
                "Real-time transaction data and spend categorization",
                "Automatic payment timing alerts",
                "Spend velocity vs. budget tracking",
              ].map((item) => (
                <li key={item} className="text-xs text-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {loadingItems ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : plaidConnected ? (
            <>
              <ConnectedSection
                items={plaidItems}
                accounts={plaidAccounts}
                syncing={syncing}
                lastSync={lastSync}
                cardNameMap={cardNameMap}
                syncErrors={syncErrors}
                onSync={handleManualSync}
                onDisconnect={handleDisconnect}
                onClearAll={handleClearAllPlaidData}
              />
              <PlaidConnectButton onSuccess={handleConnectSuccess} variant="add-another" />
            </>
          ) : (
            <PlaidConnectButton onSuccess={handleConnectSuccess} />
          )}
        </div>

        {/* ── Google Sheets ── */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <SheetsLogo />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Google Sheets</p>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 size={10} />
                  Connected
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Income & net worth data — Plaid powers live spending
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Currently pulling:</p>
            <ul className="flex flex-col gap-1">
              {[
                { label: "Monthly income from paycheck entries", primary: true },
                { label: "Net worth snapshot & savings rate", primary: true },
                { label: "Budget estimates (fallback when Plaid is unavailable)", primary: false },
              ].map((item) => (
                <li key={item.label} className="text-xs text-foreground flex items-start gap-1.5">
                  <CheckCircle2 size={11} className={`shrink-0 mt-0.5 ${item.primary ? "text-success" : "text-muted-foreground"}`} />
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
              Live spending is now powered by Plaid — Sheets handles income & net worth only.
            </p>
          </div>

          <div className="rounded-xl bg-success/5 border border-success/20 px-3 py-2.5">
            <p className="text-xs text-foreground font-medium">
              ✓ Connected via service account — refreshes automatically.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              No re-authentication needed. Data updates each time you open the Dashboard.
            </p>
          </div>
        </div>

        {/* ── Fidelity Roth IRA note ── */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <p className="text-sm font-semibold text-foreground">Fidelity Roth IRA — Not Yet Connected</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fidelity opted out of Plaid&apos;s standard bank/transaction feed, so it won&apos;t appear when you connect via Plaid above. Two paths to connect it:
          </p>
          <ul className="flex flex-col gap-1.5 mt-0.5">
            <li className="text-xs text-foreground flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5 shrink-0">1.</span>
              <span>
                <span className="font-medium">Plaid Investments product</span> — Fidelity IS supported here (holdings, transactions, securities) but requires a Plaid Growth or Custom plan. If/when your Plaid account is upgraded, this will unlock automatically.
              </span>
            </li>
            <li className="text-xs text-foreground flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5 shrink-0">2.</span>
              <span>
                <span className="font-medium">Finicity (Mastercard)</span> — Fidelity&apos;s officially preferred data-sharing partner. Supports IRA &amp; brokerage account aggregation via the &quot;Fidelity Access&quot; API. This is a second aggregator we can add to the app.
              </span>
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Last checked: May 9, 2026 · This status is monitored monthly and will update when Fidelity becomes connectable.
          </p>
        </div>

        {/* ── Manual Accounts ── */}
        <ManualAccountsSection
          accounts={manualAccounts}
          onAdd={handleAddManual}
          onEdit={handleEditManual}
          onDelete={handleDeleteManual}
        />

        <div className="rounded-xl bg-muted/50 border border-border p-4">
          <p className="text-xs font-semibold text-foreground mb-1">Your data, your control</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All connections are read-only. No account numbers or routing numbers are ever stored. Plaid access tokens are encrypted at rest with AES-256. You can disconnect at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
