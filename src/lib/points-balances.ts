// Points & certificate balances with expiry tracking.
// Used by Burn Tracker (F6).
//
// Cert expiries are user-provided; placeholder dates are set conservatively
// so urgency colors are accurate even before the user updates them.

import { CPP } from "./cards";

export interface PointsBalanceFull {
  id: string;
  program: "chase_ur" | "capital_one" | "marriott_bonvoy";
  programLabel: string;
  card: string; // source card
  color: string;
  textColor: string;
  balance: number;
  cpp: number; // cents per point — transfer value
  /** ISO date — null if points don't expire while account is open */
  expiresAt: string | null;
  /** Optional notes about expiry policy */
  expiryNote?: string;
  /** Free night certificates separate from base point balance */
  certs?: { count: number; maxPoints: number; nextExpiresAt: string; estValuePerCert: number }[];
}

// Helper: ISO date X months from now (for placeholder cert expiry)
function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

export const POINTS_FULL: PointsBalanceFull[] = [
  {
    id: "chase_ur",
    program: "chase_ur",
    programLabel: "Chase Ultimate Rewards",
    card: "CSP + CFU",
    color: "#117ACA",
    textColor: "#FFFFFF",
    balance: 12192,
    cpp: CPP.chase_ur,
    expiresAt: null,
    expiryNote:
      "Don't expire while you hold a premium Chase card (CSP/CSR/Ink). If you cancel all premium cards, points may be forfeited.",
  },
  {
    id: "capital_one",
    program: "capital_one",
    programLabel: "Capital One Miles",
    card: "Venture X",
    color: "#C8102E",
    textColor: "#FFFFFF",
    balance: 102717,
    cpp: CPP.capital_one,
    expiresAt: null,
    expiryNote:
      "Cap1 miles don't expire while account is open. Devaluation risk is the real concern — Cap1 has revalued partner ratios in past years. Consider deploying soon.",
  },
  {
    id: "marriott_bonvoy",
    program: "marriott_bonvoy",
    programLabel: "Marriott Bonvoy",
    card: "Boundless",
    color: "#8B0000",
    textColor: "#FFFFFF",
    balance: 63840,
    cpp: CPP.marriott_bonvoy,
    expiresAt: monthsFromNow(24),
    expiryNote: "Bonvoy points expire after 24 months of no activity (any earn/redeem resets).",
    certs: [
      {
        count: 5,
        maxPoints: 35000,
        // Free Night Certs typically expire 12 months after issuance.
        // Placeholder: 12 months out — user should update with actual.
        nextExpiresAt: monthsFromNow(12),
        estValuePerCert: 250, // $250 conservative; can be $400+ at premium properties
      },
    ],
  },
];

export function totalEstValue(balances: PointsBalanceFull[] = POINTS_FULL): number {
  return balances.reduce((s, b) => {
    const ptsValue = (b.balance * b.cpp) / 100;
    const certValue = (b.certs ?? []).reduce((cs, c) => cs + c.count * c.estValuePerCert, 0);
    return s + ptsValue + certValue;
  }, 0);
}
