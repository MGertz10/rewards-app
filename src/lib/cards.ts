// Card definitions, multipliers, and CPP values
// Based on CARD_RULES.md

export type PointsProgram = "chase_ur" | "capital_one" | "marriott_bonvoy";

export type Category =
  | "dining"
  | "groceries"
  | "online_grocery"
  | "streaming"
  | "drugstore"
  | "travel"
  | "gas"
  | "marriott"
  | "hotel"
  | "rental_car"
  | "flight"
  | "other";

export interface CardMultiplier {
  category: Category;
  multiplier: number;
  note?: string;
}

export interface Card {
  id: string;
  name: string;
  shortName: string;
  issuer: string;
  color: string;
  textColor: string;
  pointsProgram: PointsProgram;
  multipliers: CardMultiplier[];
  catchAllMultiplier: number;
}

// CPP values in cents per point (conservative estimates)
export const CPP: Record<PointsProgram, number> = {
  chase_ur: 1.7,       // Great via Hyatt/United transfers
  capital_one: 1.5,    // Turkish, Flying Blue (devaluation risk — prioritize deployment)
  marriott_bonvoy: 0.7, // Category 1–4 hotels; certs worth more
};

export const CARDS: Card[] = [
  {
    id: "cfu",
    name: "Chase Freedom Unlimited",
    shortName: "CFU",
    issuer: "Chase",
    color: "#117ACA",
    textColor: "#ffffff",
    pointsProgram: "chase_ur",
    catchAllMultiplier: 1.5,
    multipliers: [
      { category: "dining", multiplier: 3, note: "Includes takeout & delivery" },
      { category: "drugstore", multiplier: 3, note: "Walgreens, CVS" },
    ],
  },
  {
    id: "csp",
    name: "Chase Sapphire Preferred",
    shortName: "CSP",
    issuer: "Chase",
    color: "#1a1a2e",
    textColor: "#F5A623",
    pointsProgram: "chase_ur",
    catchAllMultiplier: 1,
    multipliers: [
      { category: "dining", multiplier: 3, note: "Includes delivery apps" },
      { category: "online_grocery", multiplier: 3, note: "Excludes Walmart, Target, Whole Foods" },
      { category: "streaming", multiplier: 3, note: "Netflix, Spotify, Hulu, etc." },
      { category: "travel", multiplier: 2, note: "Flights, hotels, rideshare, tolls, parking" },
      { category: "flight", multiplier: 2 },
      { category: "hotel", multiplier: 2 },
      { category: "rental_car", multiplier: 2 },
    ],
  },
  {
    id: "boundless",
    name: "Marriott Bonvoy Boundless",
    shortName: "Boundless",
    issuer: "Chase",
    color: "#8B0000",
    textColor: "#ffffff",
    pointsProgram: "marriott_bonvoy",
    catchAllMultiplier: 2,
    multipliers: [
      { category: "marriott", multiplier: 6, note: "All Marriott brands" },
      { category: "gas", multiplier: 3 },
      { category: "groceries", multiplier: 3 },
      { category: "dining", multiplier: 3 },
    ],
  },
  {
    id: "venture_x",
    name: "Capital One Venture X",
    shortName: "Venture X",
    issuer: "Capital One",
    color: "#cc0000",
    textColor: "#ffffff",
    pointsProgram: "capital_one",
    catchAllMultiplier: 2,
    multipliers: [
      { category: "hotel", multiplier: 10, note: "Must book via Capital One Travel portal" },
      { category: "rental_car", multiplier: 10, note: "Must book via Capital One Travel portal" },
      { category: "flight", multiplier: 5, note: "Must book via Capital One Travel portal" },
    ],
  },
];

export function getMultiplier(card: Card, category: Category): { multiplier: number; note?: string } {
  const match = card.multipliers.find((m) => m.category === category);
  if (match) return { multiplier: match.multiplier, note: match.note };
  return { multiplier: card.catchAllMultiplier };
}
