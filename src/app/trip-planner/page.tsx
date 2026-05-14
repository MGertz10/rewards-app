"use client";

import { useState } from "react";
import {
  Map,
  Plane,
  Hotel,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Info,
  Calendar,
  Users,
  ArrowRight,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";

// ─── Types ────────────────────────────────────────────────────────────────────

type CabinClass = "economy" | "business";
type RedemptionType = "flight" | "hotel";
type ValueTier = "best" | "good" | "ok" | "poor";

interface TripSeed {
  id: string;
  name: string;
  destination: string;
  emoji: string;
  dates: string;
  travelers: number;
  cabin: CabinClass;
  description: string;
  urgency?: string; // e.g. "Book flights soon"
}

interface RedemptionOption {
  id: string;
  type: RedemptionType;
  name: string;
  programName: string; // e.g. "Capital One Miles"
  cardShortName: string; // e.g. "Venture X"
  pointsCost: number; // per person one-way (flights) or per night (hotels)
  cpp: number; // cents per point
  cashEquiv: number; // dollar value of points used
  cashPrice: number; // approximate cash price for context
  tier: ValueTier;
  notes: string[];
  transferPartner?: string; // if a transfer is required
  bookingMethod: string; // e.g. "Transfer then book direct"
  promoActive?: boolean;
  certEligible?: boolean; // for hotel nights covered by free night cert
}

interface RedemptionResult {
  flights: RedemptionOption[];
  hotels: RedemptionOption[];
}

// ─── User balances ────────────────────────────────────────────────────────────

const USER_BALANCES = {
  chaseUR: 12192,
  capitalOneMiles: 102717,
  marriottBonvoy: 63840,
  marriottFreeNightCerts: 5, // up to 35k pts each
};

// ─── Pre-seeded trips ─────────────────────────────────────────────────────────

const SEEDED_TRIPS: TripSeed[] = [
  {
    id: "london-nye",
    name: "London NYE",
    destination: "London, UK",
    emoji: "🎡",
    dates: "Dec 28 – Jan 3, 2026",
    travelers: 2,
    cabin: "economy",
    description: "New Year's Eve in London. Flights needed — accommodations covered by GF's family.",
    urgency: "Book flights now — NYE routes fill fast",
  },
  {
    id: "europe-2026",
    name: "Europe 2026",
    destination: "Vienna / Prague / Budapest",
    emoji: "🏰",
    dates: "TBD 2026",
    travelers: 2,
    cabin: "economy",
    description: "Central Europe trip with girlfriend. Hotels are the main optimization opportunity.",
  },
  {
    id: "greece-croatia",
    name: "Greece / Croatia",
    destination: "Athens / Dubrovnik",
    emoji: "⛵",
    dates: "TBD 2026",
    travelers: 2,
    cabin: "economy",
    description: "Alternative Europe option. Marriott certs and Chase UR → Hyatt work great here.",
  },
];

// ─── Redemption engine ────────────────────────────────────────────────────────
// All CPP values and point costs are hardcoded from verified sweet spots.
// These should be reviewed and updated periodically as program values shift.

function calcRedemptions(destination: string, travelers: number, cabin: CabinClass): RedemptionResult {
  const isLondon = /london/i.test(destination);
  const isEurope =
    /vienna|prague|budapest|austria|czech|hungary|europe|zagreb|croatia|dubrovnik|athens|greece/i.test(destination);
  const isCentralEurope = /vienna|prague|budapest|austria|czech|hungary/i.test(destination);

  // ── Flights ───────────────────────────────────────────────────────────────

  const flights: RedemptionOption[] = [];

  if (isLondon || isEurope) {
    // Cap1 → Turkish Miles&Smiles (Star Alliance, transatlantic)
    const turkishEconPts = cabin === "economy" ? 7500 : 45000;
    const turkishCash = cabin === "economy" ? 900 : 4500;
    const turkishCPP = parseFloat(((turkishCash / turkishPts(cabin)) * 100).toFixed(2));
    flights.push({
      id: "cap1-turkish-econ",
      type: "flight",
      name: cabin === "economy" ? "Turkish Miles&Smiles — Economy Saver" : "Turkish Miles&Smiles — Business",
      programName: "Capital One Miles",
      cardShortName: "Venture X",
      pointsCost: turkishEconPts,
      cpp: turkishCPP,
      cashEquiv: parseFloat(((turkishEconPts * turkishCPP) / 100).toFixed(0)),
      cashPrice: turkishCash,
      tier: cabin === "economy" ? "best" : "good",
      transferPartner: "Turkish Airlines Miles&Smiles",
      bookingMethod: "Transfer Cap1 → Turkish, then book on turkishairlines.com",
      notes: [
        cabin === "economy"
          ? "Best economy sweet spot for transatlantic — 7,500 pts one-way via Star Alliance"
          : "45,000 pts business class one-way — excellent if availability exists",
        "Transfer is instant. Book 3–5 days after transfer request posts.",
        "Look for United, Lufthansa, or Turkish metal on the route.",
        `You have ${USER_BALANCES.capitalOneMiles.toLocaleString()} Cap1 miles — covers ${Math.floor(USER_BALANCES.capitalOneMiles / turkishEconPts)} one-way tickets.`,
      ],
    });

    // Cap1 → Air France FlyingBlue (monthly promos)
    const fbEconPts = cabin === "economy" ? 20000 : 55000;
    const fbCash = cabin === "economy" ? 900 : 4500;
    const fbCPP = parseFloat(((fbCash / fbEconPts) * 100).toFixed(2));
    flights.push({
      id: "cap1-flyingblue",
      type: "flight",
      name: "Air France FlyingBlue — Monthly Promo",
      programName: "Capital One Miles",
      cardShortName: "Venture X",
      pointsCost: fbEconPts,
      cpp: fbCPP,
      cashEquiv: parseFloat(((fbEconPts * fbCPP) / 100).toFixed(0)),
      cashPrice: fbCash,
      tier: cabin === "economy" ? "good" : "ok",
      transferPartner: "Air France / KLM FlyingBlue",
      bookingMethod: "Check flyingblue.com for this month's promo routes, then transfer",
      promoActive: true,
      notes: [
        "Monthly promo awards are typically 25–40% cheaper than standard pricing",
        "Check flyingblue.com → 'Promo Awards' before transferring — routes change monthly",
        "Also works with Chase UR at 1:1 (Chase → FlyingBlue)",
        "Paris CDG or Amsterdam AMS are easy connections to London / Central Europe",
      ],
    });

    // Chase UR → United MileagePlus
    if (isLondon || isEurope) {
      const unitedPts = cabin === "economy" ? 30000 : 70000;
      const unitedCash = cabin === "economy" ? 900 : 4500;
      const unitedCPP = parseFloat(((unitedCash / unitedPts) * 100).toFixed(2));
      flights.push({
        id: "chase-united",
        type: "flight",
        name: "United MileagePlus — Transatlantic Economy",
        programName: "Chase Ultimate Rewards",
        cardShortName: "CSP",
        pointsCost: unitedPts,
        cpp: unitedCPP,
        cashEquiv: parseFloat(((unitedPts * unitedCPP) / 100).toFixed(0)),
        cashPrice: unitedCash,
        tier: cabin === "economy" ? "good" : "ok",
        transferPartner: "United MileagePlus",
        bookingMethod: "Transfer Chase UR → United, book on united.com",
        notes: [
          `You have ${USER_BALANCES.chaseUR.toLocaleString()} Chase UR — ${unitedPts > USER_BALANCES.chaseUR ? "not quite enough for one ticket" : "enough for one ticket"}`,
          "United flies direct to London Heathrow (EWR, ORD, IAD, SFO)",
          "Saver awards required — check united.com availability first before transferring",
          "Transfer is instant; points cannot be returned after transfer",
        ],
      });
    }

    // Chase UR → Air Canada Aeroplan (Star Alliance, best Chase flight partner)
    const aeroplanPts = cabin === "economy" ? 25000 : 60000;
    const aeroplanCash = cabin === "economy" ? 900 : 4500;
    const aeroplanCPP = parseFloat(((aeroplanCash / aeroplanPts) * 100).toFixed(2));
    flights.push({
      id: "chase-aeroplan",
      type: "flight",
      name: "Air Canada Aeroplan — Star Alliance Transatlantic",
      programName: "Chase Ultimate Rewards",
      cardShortName: "CSP",
      pointsCost: aeroplanPts,
      cpp: aeroplanCPP,
      cashEquiv: parseFloat(((aeroplanPts * aeroplanCPP) / 100).toFixed(0)),
      cashPrice: aeroplanCash,
      tier: "good",
      transferPartner: "Air Canada Aeroplan",
      bookingMethod: "Transfer Chase UR → Aeroplan, book on aircanada.com",
      notes: [
        "Best Chase partner for transatlantic — distance-based pricing favors short hops",
        "Can book Star Alliance metal (United, Lufthansa, Swiss, etc.)",
        `You have ${USER_BALANCES.chaseUR.toLocaleString()} Chase UR — ${aeroplanPts > USER_BALANCES.chaseUR ? "short by " + (aeroplanPts - USER_BALANCES.chaseUR).toLocaleString() + " pts" : "sufficient for one ticket"}`,
        "Taxes on Aeroplan are reasonable — avoid routing through UK to dodge APD tax",
      ],
    });

    // Cap1 Travel Portal (flexible, lower CPP)
    const portalPts = Math.round((600 / 0.01)); // $600 flight at 1¢/pt portal rate
    flights.push({
      id: "cap1-portal",
      type: "flight",
      name: "Capital One Travel Portal — Any Flight",
      programName: "Capital One Miles",
      cardShortName: "Venture X",
      pointsCost: portalPts,
      cpp: 1.0,
      cashEquiv: portalPts * 0.01,
      cashPrice: 600,
      tier: "ok",
      bookingMethod: "Book via Capital One Travel portal — no transfer needed",
      notes: [
        "Portal value is only 1¢/pt — less efficient than direct transfers",
        `Your ${USER_BALANCES.capitalOneMiles.toLocaleString()} miles = ~$1,027 in portal value`,
        "Use portal only if no transfer partner has saver availability",
        "Flexible: works for any airline, any route, any cabin",
      ],
    });
  } else {
    // Generic domestic / other destination fallback
    flights.push({
      id: "cap1-portal-generic",
      type: "flight",
      name: "Capital One Travel Portal",
      programName: "Capital One Miles",
      cardShortName: "Venture X",
      pointsCost: 15000,
      cpp: 1.0,
      cashEquiv: 150,
      cashPrice: 150,
      tier: "ok",
      bookingMethod: "Book via Capital One Travel portal",
      notes: ["Portal value 1¢/pt — use transfer partners when available for better CPP"],
    });
  }

  // ── Hotels ────────────────────────────────────────────────────────────────

  const hotels: RedemptionOption[] = [];

  // Marriott Free Night Certs — always surface when certs available
  if (USER_BALANCES.marriottFreeNightCerts > 0) {
    const certEligible =
      isLondon
        ? "Most London Marriotts are 25k–40k pts/night — cert covers most"
        : isCentralEurope
        ? "Vienna, Prague, Budapest have many Cat 3–5 properties (20k–35k) — cert is ideal"
        : "Check category before booking — cert covers up to 35k pts";

    hotels.push({
      id: "marriott-cert",
      type: "hotel",
      name: "Marriott Free Night Certificate",
      programName: "Marriott Bonvoy",
      cardShortName: "Boundless",
      pointsCost: 0,
      cpp: 0,
      cashEquiv: isLondon ? 275 : 200,
      cashPrice: isLondon ? 275 : 200,
      tier: "best",
      bookingMethod: "Book direct on marriott.com → apply cert at checkout",
      certEligible: true,
      notes: [
        `You have ${USER_BALANCES.marriottFreeNightCerts} free night certs (up to 35k pts each)`,
        certEligible,
        "Each cert typically worth $175–$350+ at the right property",
        "Certs expire — check expiry dates in the Marriott app and use them",
        isLondon
          ? "London picks: Moxy Stratford, Courtyard London, AC Hotel Victoria"
          : "Central Europe picks: Marriott Vienna, W Prague, AC Hotel Budapest",
      ],
    });
  }

  // Marriott points
  if (isLondon) {
    hotels.push({
      id: "marriott-pts-london",
      type: "hotel",
      name: "Marriott Points — London Properties",
      programName: "Marriott Bonvoy",
      cardShortName: "Boundless",
      pointsCost: 45000, // avg London Marriott
      cpp: 0.7,
      cashEquiv: 315,
      cashPrice: 315,
      tier: "ok",
      bookingMethod: "Book direct on marriott.com with points",
      notes: [
        `You have ${USER_BALANCES.marriottBonvoy.toLocaleString()} Bonvoy points`,
        "London Marriotts range 25k–60k pts/night — peak dates push higher",
        `${USER_BALANCES.marriottBonvoy.toLocaleString()} pts ÷ 45k avg = ~${Math.floor(USER_BALANCES.marriottBonvoy / 45000)} nights`,
        "Free night cert is much better — use certs first, save points for peak nights",
        "Avoid 5th night free — Marriott removed this benefit",
      ],
    });
  }

  if (isCentralEurope) {
    hotels.push({
      id: "marriott-pts-europe",
      type: "hotel",
      name: "Marriott Points — Central Europe",
      programName: "Marriott Bonvoy",
      cardShortName: "Boundless",
      pointsCost: 30000, // avg Cat 3-5 Central Europe
      cpp: 0.7,
      cashEquiv: 210,
      cashPrice: 210,
      tier: "good",
      bookingMethod: "Book direct on marriott.com with points",
      notes: [
        "Vienna, Prague, Budapest have abundant Cat 3–5 properties (20k–35k/night)",
        `${USER_BALANCES.marriottBonvoy.toLocaleString()} pts ÷ 30k avg = ~${Math.floor(USER_BALANCES.marriottBonvoy / 30000)} nights`,
        "Andaz Vienna (Hyatt) is better value — see Chase UR → Hyatt option",
        "W Prague is a splurge at 50k–60k pts/night but spectacular",
      ],
    });
  }

  // Chase UR → Hyatt
  if (isLondon || isEurope) {
    const hyattNightly = isLondon ? 15000 : isCentralEurope ? 12000 : 14000;
    const hyattCash = isLondon ? 330 : 250;
    const hyattCPP = parseFloat(((hyattCash / hyattNightly) * 100).toFixed(2));
    hotels.push({
      id: "chase-hyatt",
      type: "hotel",
      name: `World of Hyatt — ${isLondon ? "London" : isCentralEurope ? "Vienna / Prague / Budapest" : "Europe"} Properties`,
      programName: "Chase Ultimate Rewards",
      cardShortName: "CSP",
      pointsCost: hyattNightly,
      cpp: hyattCPP,
      cashEquiv: parseFloat(((hyattNightly * hyattCPP) / 100).toFixed(0)),
      cashPrice: hyattCash,
      tier: "best",
      transferPartner: "World of Hyatt",
      bookingMethod: "Transfer Chase UR → Hyatt, book on hyatt.com",
      notes: [
        isLondon
          ? "Hyatt London: Andaz Liverpool St (~12k–18k/night), Great Scotland Yard (~15k–22k)"
          : "Andaz Vienna (~12k/night) is a standout deal — luxury hotel, great location",
        `Chase UR → Hyatt is the highest-CPP redemption available (~2.0–2.5¢)`,
        `You have ${USER_BALANCES.chaseUR.toLocaleString()} Chase UR — enough for ${Math.floor(USER_BALANCES.chaseUR / hyattNightly)} night${Math.floor(USER_BALANCES.chaseUR / hyattNightly) !== 1 ? "s" : ""} at this rate`,
        "Transfer is instant. Book standard room award for best availability.",
        "Hyatt has no peak/off-peak surcharges on standard awards",
      ],
    });
  }

  // Cash / no redemption fallback
  hotels.push({
    id: "cash-hotel",
    type: "hotel",
    name: "Book Cash — No Points",
    programName: "N/A",
    cardShortName: "Venture X",
    pointsCost: 0,
    cpp: 0,
    cashEquiv: 0,
    cashPrice: isLondon ? 300 : 200,
    tier: "poor",
    bookingMethod: "Book direct or via portal for 2x miles on Venture X",
    notes: [
      "Earn 10x Cap1 miles on hotels booked via Capital One Travel portal",
      "Or book direct and earn 2x miles on Venture X",
      "Only use cash when all points options are unavailable or poor value",
    ],
  });

  // Sort each group: best → good → ok → poor
  const tierOrder: ValueTier[] = ["best", "good", "ok", "poor"];
  const sortByTier = (a: RedemptionOption, b: RedemptionOption) =>
    tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);

  return {
    flights: flights.sort(sortByTier),
    hotels: hotels.sort(sortByTier),
  };
}

// Helper to avoid TS no-unused-var on the inline expression
function turkishPts(cabin: CabinClass) {
  return cabin === "economy" ? 7500 : 45000;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<ValueTier, { label: string; bg: string; text: string; dot: string }> = {
  best: {
    label: "Best Value",
    bg: "bg-success/10 border-success/30",
    text: "text-success",
    dot: "bg-success",
  },
  good: {
    label: "Good Value",
    bg: "bg-primary/10 border-primary/30",
    text: "text-primary",
    dot: "bg-primary",
  },
  ok: {
    label: "Decent",
    bg: "bg-warning/10 border-warning/30",
    text: "text-warning",
    dot: "bg-warning",
  },
  poor: {
    label: "Low Value",
    bg: "bg-muted border-border",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

const PROGRAM_COLORS: Record<string, { bg: string; text: string }> = {
  "Capital One Miles": { bg: "bg-red-600", text: "text-white" },
  "Chase Ultimate Rewards": { bg: "bg-[#117ACA]", text: "text-white" },
  "Marriott Bonvoy": { bg: "bg-red-900", text: "text-white" },
  "N/A": { bg: "bg-muted", text: "text-muted-foreground" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BalancePill({ label, amount, color }: { label: string; amount: string; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${color} shrink-0`}>
      <span className="text-[10px] font-semibold opacity-80 uppercase tracking-wide leading-none">{label}</span>
      <span className="text-xs font-bold mt-0.5 leading-none">{amount}</span>
    </div>
  );
}

function RedemptionCard({ option }: { option: RedemptionOption }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_CONFIG[option.tier];
  const prog = PROGRAM_COLORS[option.programName] ?? { bg: "bg-muted", text: "text-foreground" };

  return (
    <div className={`rounded-2xl border p-4 ${tier.bg} transition-all`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Tier badge */}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/60 ${tier.text}`}>
              {tier.label}
            </span>
            {option.promoActive && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/20 text-warning flex items-center gap-1">
                <Sparkles size={9} /> Promo Active
              </span>
            )}
            {option.certEligible && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/20 text-success">
                Free Night Cert
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{option.name}</p>
          {option.transferPartner && (
            <p className="text-xs text-muted-foreground mt-0.5">
              via {option.transferPartner}
            </p>
          )}
        </div>

        {/* Program badge */}
        <div className={`px-2 py-1 rounded-lg ${prog.bg} ${prog.text} shrink-0`}>
          <p className="text-[10px] font-bold uppercase tracking-wide leading-tight">{option.cardShortName}</p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-3 mt-3">
        {option.certEligible ? (
          <div className="flex-1">
            <p className="text-xl font-bold text-success">FREE</p>
            <p className="text-xs text-muted-foreground">~${fmt(option.cashEquiv)} value</p>
          </div>
        ) : option.pointsCost > 0 ? (
          <>
            <div className="flex-1">
              <p className="text-xl font-bold text-foreground">{fmt(option.pointsCost)}</p>
              <p className="text-xs text-muted-foreground">pts · one-way / per night</p>
            </div>
            <div className="text-center px-3 py-1 rounded-xl bg-background/60">
              <p className="text-sm font-bold text-foreground">{option.cpp.toFixed(1)}¢</p>
              <p className="text-[10px] text-muted-foreground">per pt</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">${fmt(option.cashEquiv)}</p>
              <p className="text-[10px] text-muted-foreground">≈ cash value</p>
            </div>
          </>
        ) : (
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Cash / Portal rate</p>
            <p className="text-xs text-muted-foreground">~${fmt(option.cashPrice)}/night est.</p>
          </div>
        )}
      </div>

      {/* Booking method */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
        <ArrowRight size={12} className="text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">{option.bookingMethod}</p>
      </div>

      {/* Expand notes */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info size={12} />
        {expanded ? "Hide" : "Show"} details
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {option.notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${tier.dot}`} />
              <p className="text-xs text-foreground leading-relaxed">{note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }: { icon: typeof Plane; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Icon size={14} className="text-primary" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">{label}</p>
      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count} options</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TripPlannerPage() {
  const [destination, setDestination] = useState("");
  const [dates, setDates] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [cabin, setCabin] = useState<CabinClass>("economy");
  const [results, setResults] = useState<RedemptionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"flights" | "hotels">("flights");

  function applyTripSeed(seed: TripSeed) {
    setDestination(seed.destination);
    setDates(seed.dates);
    setTravelers(seed.travelers);
    setCabin(seed.cabin);
    // Auto-calculate on seed tap
    setResults(calcRedemptions(seed.destination, seed.travelers, seed.cabin));
    setActiveTab("flights");
    // Scroll results into view after render
    setTimeout(() => {
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleCalculate() {
    if (!destination.trim()) return;
    setResults(calcRedemptions(destination, travelers, cabin));
    setActiveTab("flights");
    setTimeout(() => {
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const activeOptions = results ? (activeTab === "flights" ? results.flights : results.hotels) : [];

  return (
    <div className="flex flex-col min-h-screen pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Trip Planner</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Deploy your points for maximum value</p>
      </div>

      {/* Points balances snapshot */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <BalancePill
            label="Chase UR"
            amount={`${(USER_BALANCES.chaseUR / 1000).toFixed(1)}K`}
            color="bg-[#117ACA]/10 text-[#117ACA]"
          />
          <BalancePill
            label="Cap1 Miles"
            amount={`${(USER_BALANCES.capitalOneMiles / 1000).toFixed(1)}K`}
            color="bg-red-600/10 text-red-600"
          />
          <BalancePill
            label="Bonvoy"
            amount={`${(USER_BALANCES.marriottBonvoy / 1000).toFixed(1)}K`}
            color="bg-red-900/10 text-red-900"
          />
          <BalancePill
            label="FN Certs"
            amount={`${USER_BALANCES.marriottFreeNightCerts}x 35K`}
            color="bg-success/10 text-success"
          />
        </div>
      </div>

      <div className="px-4 flex flex-col gap-5">
        {/* Pre-seeded trips */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your Upcoming Trips
          </p>
          <div className="flex flex-col gap-2">
            {SEEDED_TRIPS.map((trip) => (
              <button
                key={trip.id}
                onClick={() => applyTripSeed(trip)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/50 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{trip.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{trip.name}</p>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {trip.travelers}x · {trip.cabin}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{trip.destination}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar size={10} className="text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">{trip.dates}</p>
                    </div>
                    <p className="text-xs text-foreground/70 mt-1.5 leading-snug">{trip.description}</p>
                    {trip.urgency && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertTriangle size={11} className="text-warning shrink-0" />
                        <p className="text-[11px] text-warning font-medium">{trip.urgency}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end mt-3 pt-2 border-t border-border/50">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    Calculate options <ArrowRight size={12} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Input form */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Custom Trip
          </p>

          {/* Destination */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Destination
            </label>
            <div className="relative">
              <Map size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. London, UK or Vienna, Austria"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Travel Dates (optional)
            </label>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="e.g. Dec 28 – Jan 3"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Travelers + Cabin row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Travelers
              </label>
              <div className="relative">
                <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={travelers}
                  onChange={(e) => setTravelers(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "traveler" : "travelers"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Cabin
              </label>
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(["economy", "business"] as CabinClass[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCabin(c)}
                    className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                      cabin === c
                        ? "bg-primary text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={!destination.trim()}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            Calculate Best Options
          </button>
        </div>

        {/* Results */}
        {results && (
          <div id="results-section">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("flights")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === "flights"
                    ? "bg-primary text-white"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Plane size={14} />
                Flights
                {results.flights.some((o) => o.tier === "best") && (
                  <span className="w-2 h-2 rounded-full bg-success" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("hotels")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === "hotels"
                    ? "bg-primary text-white"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Hotel size={14} />
                Hotels
                {results.hotels.some((o) => o.tier === "best") && (
                  <span className="w-2 h-2 rounded-full bg-success" />
                )}
              </button>
            </div>

            {/* Tier legend */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              {(Object.entries(TIER_CONFIG) as [ValueTier, (typeof TIER_CONFIG)[ValueTier]][]).map(
                ([tier, cfg]) => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
                  </div>
                )
              )}
            </div>

            {/* Section header */}
            <SectionHeader
              icon={activeTab === "flights" ? Plane : Hotel}
              label={activeTab === "flights" ? "Flight Redemptions" : "Hotel Redemptions"}
              count={activeOptions.length}
            />

            {/* Redemption cards */}
            <div className="flex flex-col gap-3">
              {activeOptions.map((option) => (
                <RedemptionCard key={option.id} option={option} />
              ))}
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-muted/50 border border-border">
              <Info size={13} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Point costs and CPP values are estimates based on typical sweet spots. Always verify award
                availability before transferring points — transfers are generally irreversible. CPP calculations
                assume approximate cash prices and may vary.
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
              <Map size={28} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Tap a trip above or enter a destination to see ranked redemption options across all your points.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
