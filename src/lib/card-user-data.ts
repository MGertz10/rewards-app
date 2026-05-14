// User-provided card metadata.
// Primary storage: Supabase `user_card_metadata` table (persists across devices + PWA).
// Fallback: localStorage (offline / first load before DB is set up).

import { CARDS, type Card } from "./cards";

export const CARD_METADATA_KEY = "rewards_card_metadata_v2";

export interface CardMetadata {
  /** ISO YYYY-MM-DD — when the account was opened */
  openedDate: string;
  /** 1–31 — day of month the statement closes */
  statementCloseDay: number;
  /** 1–31 — day of month the payment is due */
  dueDay: number;
  /** Total credit limit in USD */
  creditLimit: number;
  /** Last 4 digits, for identification */
  last4: string;
  /** Whether to include card in optimizer / strategy calculations */
  active: boolean;
  /** Marriott Bonvoy: next free night cert expiry (ISO YYYY-MM-DD) */
  certExpiry?: string;
  /** Marriott Bonvoy: how many valid certs are available */
  certCount?: number;
}

export type AllCardMetadata = Record<string, Partial<CardMetadata>>;

// ── localStorage (fallback) ──────────────────────────────────────────────────

export function loadCardMetadata(): AllCardMetadata {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CARD_METADATA_KEY);
    return raw ? (JSON.parse(raw) as AllCardMetadata) : {};
  } catch {
    return {};
  }
}

export function saveCardMetadata(data: AllCardMetadata): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CARD_METADATA_KEY, JSON.stringify(data));
}

// ── Server API (primary — routes through service role, always has write access) ──

/** Load card metadata via the server API route. Falls back to localStorage. */
export async function loadCardMetadataFromDB(): Promise<AllCardMetadata> {
  try {
    const res = await fetch("/api/cards/metadata");
    if (!res.ok) throw new Error("API error");
    const { data } = await res.json();

    if (!data || data.length === 0) {
      // Nothing saved yet — check localStorage for a one-time migration
      return loadCardMetadata();
    }

    const result: AllCardMetadata = {};
    for (const row of data) {
      result[row.card_id] = {
        openedDate: row.opened_date ?? "",
        statementCloseDay: row.statement_close_day ?? 0,
        dueDay: row.due_day ?? 0,
        creditLimit: row.credit_limit ?? 0,
        last4: row.last4 ?? "",
        active: row.active ?? true,
        ...(row.cert_expiry ? { certExpiry: row.cert_expiry } : {}),
        ...(row.cert_count != null ? { certCount: row.cert_count } : {}),
      };
    }
    return result;
  } catch {
    return loadCardMetadata(); // localStorage fallback
  }
}

/** Save card metadata via the server API route. Also writes localStorage as backup. */
export async function saveCardMetadataToDB(data: AllCardMetadata): Promise<void> {
  // Always write localStorage as instant backup
  saveCardMetadata(data);

  const rows = Object.entries(data).map(([card_id, meta]) => ({
    card_id,
    opened_date: meta.openedDate || null,
    statement_close_day: meta.statementCloseDay || null,
    due_day: meta.dueDay || null,
    credit_limit: meta.creditLimit || null,
    last4: meta.last4 || null,
    active: meta.active ?? true,
    cert_expiry: meta.certExpiry ?? null,
    cert_count: meta.certCount ?? null,
    updated_at: new Date().toISOString(),
  }));

  try {
    const res = await fetch("/api/cards/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error("API error");
  } catch (err) {
    console.error("[saveCardMetadataToDB]", err);
    // localStorage backup already written above
  }
}

// ── Merge static Card with user overrides ─────────────────────────────────

export function getMergedCard(card: Card, meta: AllCardMetadata): Card {
  const m = meta[card.id];
  if (!m) return card;
  return {
    ...card,
    openedDate: m.openedDate || card.openedDate,
    statementCloseDay: m.statementCloseDay ?? card.statementCloseDay,
    dueDay: m.dueDay ?? card.dueDay,
    creditLimit: m.creditLimit ?? card.creditLimit,
    last4: m.last4 || card.last4,
  };
}

/** Returns all CARDS from lib/cards.ts with any stored user overrides applied. */
export function getMergedCards(meta?: AllCardMetadata): Card[] {
  const m = meta ?? loadCardMetadata();
  return CARDS.map((c) => getMergedCard(c, m));
}

/** Check if a given card has all the critical scheduling fields filled in. */
export function cardIsConfigured(cardId: string, meta: AllCardMetadata): boolean {
  const m = meta[cardId];
  if (!m) return false;
  return !!(
    m.openedDate &&
    m.statementCloseDay &&
    m.dueDay &&
    m.creditLimit &&
    m.last4
  );
}

/** Count how many cards still need setup */
export function unconfiguredCount(meta: AllCardMetadata): number {
  return CARDS.filter((c) => !cardIsConfigured(c.id, meta)).length;
}
