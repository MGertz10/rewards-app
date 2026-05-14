// Hook that maps Plaid account masks (last 4 digits) to friendly card names.
// Priority order:
//   1. user_card_metadata.last4 → card.shortName  (set in Settings → My Cards)
//   2. Plaid account name fuzzy-match → known card shortName  (no setup needed)
//   3. Raw Plaid name as-is

"use client";

import { useEffect, useState } from "react";
import { CARDS } from "./cards";

// ─── Plaid-name → friendly name auto-detection ───────────────────────────────
// Chase and Capital One return product names via Plaid OAuth (e.g. "Sapphire Preferred").
// This map lets us show friendly names without requiring last4 setup in Settings.

const PLAID_NAME_MAP: Array<{ pattern: RegExp; shortName: string }> = [
  { pattern: /freedom\s+unlimited/i,  shortName: "Freedom Unlimited" },
  { pattern: /freedom\s+flex/i,       shortName: "Freedom Flex" },
  { pattern: /sapphire\s+preferred/i, shortName: "Sapphire Preferred" },
  { pattern: /sapphire\s+reserve/i,   shortName: "Sapphire Reserve" },
  { pattern: /bonvoy\s+boundless/i,   shortName: "Bonvoy Boundless" },
  { pattern: /bonvoy\s+bold/i,        shortName: "Bonvoy Bold" },
  { pattern: /boundless/i,            shortName: "Bonvoy Boundless" },
  { pattern: /venture\s+x/i,          shortName: "Venture X" },
  { pattern: /venture\b/i,            shortName: "Venture" },
  { pattern: /quicksilver/i,          shortName: "Quicksilver" },
  { pattern: /bilt/i,                 shortName: "Bilt" },
  { pattern: /gold\s+card/i,          shortName: "Amex Gold" },
  { pattern: /platinum\s+card/i,      shortName: "Amex Platinum" },
];

export function detectCardNameFromPlaid(plaidName: string | null): string | null {
  if (!plaidName) return null;
  for (const { pattern, shortName } of PLAID_NAME_MAP) {
    if (pattern.test(plaidName)) return shortName;
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCardNameMap(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/cards/metadata")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const m = new Map<string, string>();
        for (const row of data) {
          if (row.last4) {
            const card = CARDS.find((c) => c.id === row.card_id);
            if (card) m.set(row.last4, card.shortName);
          }
        }
        setMap(m);
      })
      .catch(() => {});
  }, []);

  return map;
}

// ─── Name resolution ──────────────────────────────────────────────────────────

/** Returns the best friendly display name for a Plaid account.
 *
 *  Priority:
 *  1. last4 mapped via user_card_metadata  →  "CFU ····0251"
 *  2. Plaid name auto-detected            →  "Sapphire Preferred ····1234"
 *  3. Raw Plaid name cleaned up           →  "CREDIT CARD ····1234"
 */
export function resolveAccountName(
  mask: string | null,
  rawName: string | null,
  cardNameMap: Map<string, string>
): string {
  const suffix = mask ? ` ····${mask}` : "";

  // 1. User-configured mapping via last4 (highest priority)
  if (mask && cardNameMap.has(mask)) {
    return `${cardNameMap.get(mask)}${suffix}`;
  }

  // 2. Auto-detect from Plaid account name
  const detected = detectCardNameFromPlaid(rawName);
  if (detected) {
    return `${detected}${suffix}`;
  }

  // 3. Raw Plaid name
  const base = rawName ?? "Account";
  return `${base}${suffix}`;
}
