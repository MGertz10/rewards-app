// Card scoring engine
// Score = multiplier × CPP × amount

import { CARDS, CPP, getMultiplier, type Category, type Card } from "./cards";

export interface CardResult {
  card: Card;
  multiplier: number;
  pointsEarned: number;
  dollarValue: number;
  cpp: number;
  note?: string;
  rank: "best" | "good" | "skip";
}

export function scoreCards(category: Category, amount: number): CardResult[] {
  const results = CARDS.map((card) => {
    const { multiplier, note } = getMultiplier(card, category);
    const cpp = CPP[card.pointsProgram];
    const pointsEarned = Math.round(amount * multiplier);
    const dollarValue = parseFloat(((pointsEarned * cpp) / 100).toFixed(2));

    return { card, multiplier, pointsEarned, dollarValue, cpp, note };
  });

  // Sort by dollar value descending
  results.sort((a, b) => b.dollarValue - a.dollarValue);

  // Assign ranks
  const best = results[0].dollarValue;
  return results.map((r, i) => ({
    ...r,
    rank: i === 0 ? "best" : r.dollarValue >= best * 0.9 ? "good" : "skip",
  }));
}

export function formatPoints(points: number): string {
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
  return points.toString();
}

export function programName(card: Card): string {
  const names: Record<string, string> = {
    chase_ur: "Chase Ultimate Rewards",
    capital_one: "Capital One Miles",
    marriott_bonvoy: "Marriott Bonvoy",
  };
  return names[card.pointsProgram] ?? card.pointsProgram;
}
