// Strategy Hub data — manually curated, refreshed periodically.
// Last updated: May 2026

export interface TransferPartner {
  airline: string;
  ratio: string; // e.g. "1:1"
  bonusNote?: string; // e.g. "30% bonus through May 31"
  bonusActive: boolean;
  sweetSpot?: string;
}

export interface PointsProgram {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  cpp: number; // cents per point — realistic transfer value
  cpp_portal: number; // cpp when used through portal
  partners: TransferPartner[];
  notes: string[];
}

export interface CardAnnualFeeData {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  annualFee: number;
  benefits: { label: string; value: number; notes?: string }[];
  verdict: "keep" | "downgrade" | "monitor";
  verdictNote: string;
}

export interface CardToConsider {
  name: string;
  issuer: string;
  annualFee: number;
  currentBonus: string;
  bonusValue: string;
  minSpend: string;
  keyBenefits: string[];
  fitScore: number; // 1-10
  fitNote: string;
  applyUrl?: string;
}

// ─── Points Programs ─────────────────────────────────────────────────────────

export const POINTS_PROGRAMS: PointsProgram[] = [
  {
    id: "chase_ur",
    name: "Chase Ultimate Rewards",
    shortName: "Chase UR",
    color: "#117ACA",
    textColor: "#FFFFFF",
    cpp: 1.7,
    cpp_portal: 1.25,
    notes: [
      "Best redeemed via Hyatt (up to 2.5¢+) or United/BA for international flights",
      "Transfer instantly 1:1 to 14 airline + hotel partners",
      "Never expire while you hold a premium Chase card",
    ],
    partners: [
      { airline: "World of Hyatt", ratio: "1:1", bonusActive: false, sweetSpot: "Luxury hotels 12k–22k/night" },
      { airline: "United MileagePlus", ratio: "1:1", bonusActive: false, sweetSpot: "Domestic saver ~7,500 pts one-way" },
      { airline: "British Airways Avios", ratio: "1:1", bonusActive: false, sweetSpot: "Short-haul under 650 miles" },
      { airline: "Air France/KLM FlyingBlue", ratio: "1:1", bonusNote: "Promo awards ~25% off monthly", bonusActive: true, sweetSpot: "Monthly promo routes" },
      { airline: "Singapore Airlines KrisFlyer", ratio: "1:1", bonusActive: false, sweetSpot: "Business class to Asia" },
      { airline: "Southwest Rapid Rewards", ratio: "1:1", bonusActive: false },
      { airline: "Air Canada Aeroplan", ratio: "1:1", bonusActive: false, sweetSpot: "Star Alliance redemptions" },
      { airline: "Marriott Bonvoy", ratio: "1:1", bonusActive: false },
      { airline: "IHG Rewards", ratio: "1:1", bonusActive: false },
    ],
  },
  {
    id: "capital_one",
    name: "Capital One Miles",
    shortName: "Cap1 Miles",
    color: "#C8102E",
    textColor: "#FFFFFF",
    cpp: 1.5,
    cpp_portal: 1.0,
    notes: [
      "Strong for transfer to Air France/KLM and Turkish Airlines",
      "Portal value 1¢/pt — only use portal for flights that aren't on transfer partners",
      "$300 annual travel credit effectively reduces Venture X fee to $95",
    ],
    partners: [
      { airline: "Air France/KLM FlyingBlue", ratio: "1:1", bonusNote: "Promo awards ~25% off monthly", bonusActive: true, sweetSpot: "Monthly promo routes to Europe" },
      { airline: "Turkish Airlines Miles&Smiles", ratio: "1:1", bonusActive: false, sweetSpot: "Star Alliance — great US domestic rates" },
      { airline: "Avianca LifeMiles", ratio: "1:1", bonusActive: false, sweetSpot: "Star Alliance redemptions" },
      { airline: "British Airways Avios", ratio: "1:1", bonusActive: false },
      { airline: "Singapore Airlines KrisFlyer", ratio: "1:1", bonusActive: false },
      { airline: "Air Canada Aeroplan", ratio: "1:1", bonusActive: false },
      { airline: "Wyndham Rewards", ratio: "1:1", bonusActive: false },
      { airline: "Choice Privileges", ratio: "1:1", bonusActive: false },
    ],
  },
  {
    id: "marriott",
    name: "Marriott Bonvoy",
    shortName: "Bonvoy",
    color: "#8B0000",
    textColor: "#FFFFFF",
    cpp: 0.7,
    cpp_portal: 0.7,
    notes: [
      "Best value: use points for high-demand nights where cash rates are $300+",
      "Transfer 60k Bonvoy → 25k airline miles (poor ratio — avoid unless bonus)",
      "5 free night certs (up to 50k pts each) are worth $250–$500+ each at right properties",
      "Peak/off-peak pricing — book off-peak for best value",
    ],
    partners: [
      { airline: "United MileagePlus", ratio: "3:1 + 5k bonus at 60k", bonusActive: false },
      { airline: "Delta SkyMiles", ratio: "3:1 + 5k bonus at 60k", bonusActive: false },
      { airline: "American AAdvantage", ratio: "3:1 + 5k bonus at 60k", bonusActive: false },
      { airline: "British Airways Avios", ratio: "3:1 + 5k bonus at 60k", bonusActive: false },
      { airline: "Air France/KLM FlyingBlue", ratio: "3:1 + 5k bonus at 60k", bonusActive: false },
    ],
  },
];

// ─── Card Annual Fee Analysis ─────────────────────────────────────────────────

export const CARD_FEE_ANALYSIS: CardAnnualFeeData[] = [
  {
    id: "venture_x",
    name: "Capital One Venture X",
    shortName: "Venture X",
    color: "#C8102E",
    textColor: "#FFFFFF",
    annualFee: 395,
    benefits: [
      { label: "$300 Travel Credit (portal)", value: 300, notes: "Use for hotels/flights via Cap1 portal" },
      { label: "10,000 bonus miles/yr", value: 100, notes: "Worth ~$150 if transferred well" },
      { label: "Priority Pass Unlimited", value: 429, notes: "Unlimited lounge access for you + 2 guests" },
      { label: "Global Entry / TSA Pre✓", value: 100, notes: "Every 4 years" },
    ],
    verdict: "keep",
    verdictNote: "Net cost ~-$534 in value vs $395 fee. The travel credit alone nearly covers the fee. Keep as long as you travel 3+ times/year.",
  },
  {
    id: "csp",
    name: "Chase Sapphire Preferred",
    shortName: "CSP",
    color: "#117ACA",
    textColor: "#FFFFFF",
    annualFee: 95,
    benefits: [
      { label: "$50 Hotel Credit (portal)", value: 50, notes: "Chase Travel hotel booking" },
      { label: "10% Anniversary Bonus", value: 65, notes: "~$65 based on your spend" },
      { label: "Primary Rental Car Insurance", value: 75, notes: "Valuable — saves separate insurance" },
      { label: "Trip Cancellation/Delay", value: 50, notes: "Up to $10K per trip" },
    ],
    verdict: "monitor",
    verdictNote: "Net value ~$145 vs $95 fee — justifiable. Consider upgrading to CSR when income grows for 1.5¢ portal value. Keep for now.",
  },
  {
    id: "cfu",
    name: "Chase Freedom Unlimited",
    shortName: "CFU",
    color: "#1A1A2E",
    textColor: "#FFFFFF",
    annualFee: 0,
    benefits: [
      { label: "No annual fee", value: 0 },
      { label: "1.5x on all spend", value: 0, notes: "Complements CSP — pool UR points" },
      { label: "3x dining & drugstores", value: 0 },
    ],
    verdict: "keep",
    verdictNote: "Free card. Keep forever — it pools Chase UR points with your CSP for transfer eligibility.",
  },
  {
    id: "boundless",
    name: "Marriott Bonvoy Boundless",
    shortName: "Boundless",
    color: "#8B0000",
    textColor: "#FFFFFF",
    annualFee: 95,
    benefits: [
      { label: "Free Night Cert (up to 35k)", value: 175, notes: "Typically worth $175-$300 at Marriott" },
      { label: "Silver Elite Status", value: 50, notes: "Late checkout, bonus points" },
      { label: "15 Elite Night Credits/yr", value: 30, notes: "Counts toward Gold status" },
    ],
    verdict: "monitor",
    verdictNote: "Free night cert covers the fee if you use it at a 35k property. Watch for Marriott devaluations — downgrade to Bold (no fee) if cert value drops.",
  },
];

// ─── Cards to Consider ───────────────────────────────────────────────────────

export const CARDS_TO_CONSIDER: CardToConsider[] = [
  {
    name: "Bilt Mastercard",
    issuer: "Wells Fargo",
    annualFee: 0,
    currentBonus: "None (no sign-up bonus)",
    bonusValue: "N/A",
    minSpend: "N/A",
    keyBenefits: [
      "Earn points on rent (no processing fee)",
      "2x dining, 3x on Bilt Travel, 1x everything",
      "Transfers to United, Hyatt, AA, Alaska, and more",
      "Must use card 5x/month to earn points",
    ],
    fitScore: 6,
    fitNote: "Only worth it if you pay rent with card. Recent devaluations (June 2024) hurt transfer partners. No SUB is a real downside. Skip unless rent savings are significant.",
  },
  {
    name: "Chase Sapphire Reserve",
    issuer: "Chase",
    annualFee: 550,
    currentBonus: "60,000 points after $4,000 spend in 3 months",
    bonusValue: "~$900",
    minSpend: "$4,000 / 3 months",
    keyBenefits: [
      "$300 annual travel credit (very flexible)",
      "1.5¢/pt redemption in Chase Travel portal",
      "3x on dining + travel",
      "Priority Pass + lounge access",
      "Primary rental car insurance",
    ],
    fitScore: 7,
    fitNote: "Upgrade path from CSP — makes sense when travel spend increases. The 60k SUB is solid. But 5/24 rule applies and you'd need to downgrade CSP first.",
  },
  {
    name: "Amex Gold Card",
    issuer: "American Express",
    annualFee: 325,
    currentBonus: "60,000 Membership Rewards after $6,000 spend in 6 months",
    bonusValue: "~$900",
    minSpend: "$6,000 / 6 months",
    keyBenefits: [
      "4x at restaurants (including delivery)",
      "4x at U.S. supermarkets (up to $25k/yr)",
      "$120 dining credit ($10/mo at select restaurants)",
      "$120 Uber Cash per year",
      "Access to 20+ airline transfer partners",
    ],
    fitScore: 8,
    fitNote: "Strong for your Food category (~$600/mo). 4x dining + 4x groceries would earn significantly more than CSP's 3x. Amex MR opens new transfer partners (ANA, Avianca). Worth considering.",
  },
];

// ─── Deals & Offers ──────────────────────────────────────────────────────────
//
// score: 1.0–10.0  (calculated — see scoreDeals() below)
//   Transfer bonuses: base on program CPP rank + bonus %, user relevance, urgency
//   Card SUBs: SUB value vs. AF, profile fit, Chase 5/24 status
//   Limited offers: time-sensitivity + projected value
//

export type DealType = "transfer_bonus" | "card_sub" | "limited_offer" | "sweet_spot";

export interface Deal {
  id: string;
  type: DealType;
  headline: string;
  subheadline: string;
  program: string;           // Source program (Chase UR, Cap1 Miles, etc.)
  programColor: string;
  partner?: string;          // Transfer partner name
  bonusPct?: number;         // e.g. 30 for 30% transfer bonus
  score: number;             // 1.0–10.0
  scoreReason: string;       // short explainer: "30% on 1.7¢ UR = +0.51¢/pt transferred"
  urgency: "hot" | "medium" | "low";
  expiresNote?: string;      // "Through June 15" | "Ongoing" | "Limited seats"
  expiresAt?: string;        // ISO date for countdown — null = ongoing
  description: string;       // 2-3 sentences: what to do and why it matters for your portfolio
  userNote?: string;         // Personalized: "You have 102K Cap1 miles — worth up to $510 here"
  action: string;            // CTA label
  actionUrl?: string;
  tags: string[];            // e.g. ["london", "europe", "hotel", "limited"]
}

// Score a deal 1–10. Called at runtime so user's real balances can influence it.
// userBalances: { chase_ur: number, capital_one: number, marriott: number }
export function scoreDeals(
  deals: Deal[],
  userBalances: { chase_ur: number; capital_one: number; marriott: number }
): Deal[] {
  return deals.map((d) => {
    let score = d.score; // base score is seeded — runtime can boost it
    if (d.program === "Chase UR" && userBalances.chase_ur > 5_000) score = Math.min(10, score + 0.3);
    if (d.program === "Capital One" && userBalances.capital_one > 20_000) score = Math.min(10, score + 0.3);
    if (d.program === "Marriott Bonvoy" && userBalances.marriott > 20_000) score = Math.min(10, score + 0.2);
    return { ...d, score: Math.round(score * 10) / 10 };
  });
}

// ── Seeded deals (May 2026) ───────────────────────────────────────────────────

export const DEALS: Deal[] = [
  {
    id: "flyingblue_promo_may26",
    type: "limited_offer",
    headline: "Air France / FlyingBlue Promo Awards",
    subheadline: "~25% off select routes — resets monthly",
    program: "Chase UR",
    programColor: "#117ACA",
    partner: "Air France / KLM FlyingBlue",
    score: 8.8,
    scoreReason: "25% bonus effectively raises Chase UR value to ~2.1¢/pt on promo routes; Cap1 stacks too",
    urgency: "hot",
    expiresNote: "Refreshes June 1 — book May routes now",
    expiresAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    description:
      "FlyingBlue runs monthly promo award sales — typically 25–30% off partner flights. Both Chase UR and Cap1 Miles transfer 1:1 to FlyingBlue. This month's promos often include transatlantic routes perfect for your Europe 2026 trip. Check flyingblue.com for active routes before the month flips.",
    userNote: "You have 12K Chase UR + 102K Cap1 — that's $2,400+ in potential value at promo rates.",
    action: "Check FlyingBlue Promos",
    actionUrl: "https://www.flyingblue.com/en/earn/promos",
    tags: ["europe", "london", "flight", "limited", "transfer"],
  },
  {
    id: "cap1_turkish_london",
    type: "sweet_spot",
    headline: "Cap1 → Turkish Miles&Smiles for London",
    subheadline: "Best value for transatlantic on Star Alliance",
    program: "Capital One",
    programColor: "#C8102E",
    partner: "Turkish Airlines Miles&Smiles",
    score: 8.2,
    scoreReason: "45K–55K pts biz class NYC→LHR at ~2¢/pt via Turkish; cap1 1:1 transfer no fee",
    urgency: "medium",
    expiresNote: "Ongoing — book 60 days out for award availability",
    description:
      "Turkish Miles&Smiles prices transatlantic award flights at some of the lowest rates in Star Alliance. Business class NYC→London roundtrip: ~45,000 points. Economy: ~22,500. Transfer Cap1 miles 1:1 with no fee. Award space opens ~355 days out — book early for December travel.",
    userNote: "Your 102K Cap1 miles cover round-trip business class to London with miles to spare.",
    action: "Search Award Space",
    actionUrl: "https://www.turkishairlines.com/en-us/miles-and-smiles/award-search/",
    tags: ["london", "flight", "transatlantic", "business-class"],
  },
  {
    id: "chase_hyatt_standard",
    type: "sweet_spot",
    headline: "Chase UR → World of Hyatt",
    subheadline: "Best standard transfer — up to 2.5¢/pt",
    program: "Chase UR",
    programColor: "#117ACA",
    partner: "World of Hyatt",
    score: 7.9,
    scoreReason: "Category 1 Hyatt at 3,500 pts/night often $150+ cash = 4.3¢/pt; always 1:1 transfer",
    urgency: "low",
    expiresNote: "Ongoing",
    description:
      "Hyatt is consistently the best transfer partner for Chase UR — you can get 2–5¢ per point at the right property. Especially powerful for boutique European hotels during your 2026 Europe trip. Category 1–4 properties are the sweet spot. No transfer bonus needed — the ratio already wins.",
    userNote: "12K Chase UR = up to 3.4 free nights at a Category 2 Hyatt ($180+/night value).",
    action: "Search Hyatt Awards",
    actionUrl: "https://www.hyatt.com/explore-hotels/all-locations?usePoints=true",
    tags: ["hotel", "europe", "standard", "hyatt"],
  },
  {
    id: "amex_gold_elevated",
    type: "card_sub",
    headline: "Amex Gold — 90,000 MR Points",
    subheadline: "$6K spend in 6 months · ~$1,350 value",
    program: "Amex MR",
    programColor: "#B8860B",
    score: 8.4,
    scoreReason: "90K MR = $1,350+ transferred to Aeroplan or ANA; Amex 4x dining adds ~$600/yr on your food spend",
    urgency: "hot",
    expiresNote: "Elevated offer — expires periodically, verify before applying",
    description:
      "The Amex Gold has been running an elevated 90K MR offer (vs. standard 60K). For your food-heavy spend profile (~$600/mo dining + groceries), the 4x earn alone adds significant ongoing value. MR opens 20+ transfer partners not available via Chase or Cap1 — including ANA, Avianca LifeMiles, and Cathay Pacific Asia Miles.",
    userNote: "Your ~$600/mo food spend would earn ~28,800 MR/yr at 4x — worth ~$432 transferred vs. ~$216 on your CSP.",
    action: "Check Current Offer",
    actionUrl: "https://www.americanexpress.com/en-us/credit-cards/gold-card/46234/",
    tags: ["new-card", "amex", "dining", "elevated-sub"],
  },
  {
    id: "csr_upgrade_csp",
    type: "card_sub",
    headline: "CSP → CSR Product Change",
    subheadline: "No 5/24 impact · $655 more value/yr",
    program: "Chase UR",
    programColor: "#117ACA",
    score: 7.2,
    scoreReason: "CSR portal raises UR to 1.5¢ vs 1.25¢; $300 flexible travel credit vs $50 hotel; net ~$200 benefit over CSP at your spend",
    urgency: "low",
    expiresNote: "Best to call after CSP anniversary to avoid double fee",
    description:
      "Product changing CSP → CSR (Sapphire Reserve) gives you the $300 flexible travel credit, 1.5¢ portal rate, Priority Pass, and 3x on all travel/dining — with no hard pull and no 5/24 impact. The fee jumps to $550 but the flexible $300 travel credit + annual points bonus covers most of it. Makes sense when your travel frequency increases.",
    userNote: "Wait until your CSP anniversary to avoid paying two fees. Call Chase and request product change.",
    action: "View CSR Benefits",
    actionUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
    tags: ["upgrade", "chase", "sapphire", "travel"],
  },
  {
    id: "marriott_free_night_deploy",
    type: "limited_offer",
    headline: "Deploy Your 5 Marriott Free Night Certs",
    subheadline: "Up to 35K pts each — worth $175–$500+",
    program: "Marriott Bonvoy",
    programColor: "#8B0000",
    score: 9.1,
    scoreReason: "Certs expire and are worth $250–$500+ at the right property; deploying correctly = 5¢–10¢+ per Bonvoy point equivalent",
    urgency: "hot",
    expiresNote: "Check Marriott app — certs expire ~1 year post-issuance",
    description:
      "Your 5 Bonvoy Boundless free night certs (up to 35,000 pts each) are your highest-value asset right now. At the right Category 5–6 property, each cert is worth $300–$500. Target: London/European Marriott properties for your December trip or Europe 2026. Top-up with points if nightly rate is 35k–50k. Must book before expiry.",
    userNote: "5 certs × $300 avg = $1,500 in value. Don't let them expire unused.",
    action: "Search Marriott Properties",
    actionUrl: "https://www.marriott.com/search/findHotels.mi?isRedemption=true",
    tags: ["hotel", "london", "europe", "urgent", "free-night"],
  },
  {
    id: "chase_ink_preferred_sub",
    type: "card_sub",
    headline: "Chase Ink Business Preferred",
    subheadline: "100,000 UR after $8K spend · ~$1,700 value",
    program: "Chase UR",
    programColor: "#117ACA",
    score: 7.6,
    scoreReason: "100K UR = $1,700 transferred to Hyatt; pools with existing UR balance; $95 AF",
    urgency: "medium",
    expiresNote: "Standard offer — available ongoing",
    description:
      "If you have any freelance, side income, or business purchases, the Chase Ink Business Preferred is the best current SUB in the Chase ecosystem. 100K UR pools directly with your existing Chase points. Only counts as 1 card toward 5/24 (business cards don't show on personal report). The $95 fee is easily offset.",
    userNote: "Adds to your existing 12K Chase UR — combined 112K UR = multiple Hyatt nights or a transatlantic flight.",
    action: "Learn More",
    actionUrl: "https://creditcards.chase.com/business-credit-cards/ink/preferred",
    tags: ["new-card", "chase", "business", "chase-ur"],
  },
  {
    id: "bonvoy_airline_avoid",
    type: "sweet_spot",
    headline: "⚠️ Avoid Bonvoy → Airline Transfers",
    subheadline: "3:1 ratio + 5K bonus — very poor value",
    program: "Marriott Bonvoy",
    programColor: "#8B0000",
    score: 1.8,
    scoreReason: "3 Bonvoy pts → 1 airline mile; effectively valuing Bonvoy at 0.23¢ vs. 0.7¢ held; only worthwhile with 50%+ transfer bonus",
    urgency: "low",
    expiresNote: "Permanent — unless Marriott runs a transfer bonus",
    description:
      "Marriott's airline transfer ratio (60K Bonvoy → 25K airline miles) is one of the worst in points. Only consider it if Marriott runs a 25%+ transfer bonus — then it can approach break-even. In all other cases, keep Bonvoy points for hotel stays where you get 0.5¢–1.5¢ per point.",
    action: "Skip — Keep Points for Hotels",
    tags: ["avoid", "marriott", "airline"],
  },
];

// ─── Active Alerts ────────────────────────────────────────────────────────────

export interface StrategyAlert {
  type: "bonus" | "devaluation" | "deal" | "reminder";
  title: string;
  body: string;
  urgency: "high" | "medium" | "low";
  expiresNote?: string;
}

export const STRATEGY_ALERTS: StrategyAlert[] = [
  {
    type: "bonus",
    title: "Air France FlyingBlue Promo Awards",
    body: "Monthly promo routes active — typically 25% off for both Chase UR and Cap1 Miles transfers. Check flyingblue.com for this month's routes.",
    urgency: "medium",
    expiresNote: "Refreshes monthly",
  },
  {
    type: "reminder",
    title: "5 Marriott Free Night Certs — Use Them",
    body: "Your Bonvoy Boundless free night certs (up to 35k pts each) need to be booked before they expire. Each is worth $175–$300+ at the right property.",
    urgency: "high",
    expiresNote: "Expiry varies — check Marriott app",
  },
  {
    type: "deal",
    title: "Capital One 102K Miles — London Sweet Spot",
    body: "Turkish Airlines Miles&Smiles via Cap1 transfer: ~7,500–30,000 pts for domestic Star Alliance, ~45,000 pts for transatlantic biz. Check availability early.",
    urgency: "medium",
  },
];
