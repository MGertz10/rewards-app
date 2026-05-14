"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Star,
  Zap,
  Shield,
  Gift,
  CreditCard,
  Plane,
  Hotel,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from "lucide-react";
import { SubPageHeader } from "@/components/sub-page-header";
import { CARDS, CPP, type Card, type Category } from "@/lib/cards";
import { POINTS_FULL } from "@/lib/points-balances";

// ─── Static benefits data ────────────────────────────────────────────────────
// Annual credits and perks not captured in the multiplier engine.

interface AnnualCredit {
  label: string;
  value: number; // USD
  note?: string;
}

interface Perk {
  icon: React.ElementType;
  label: string;
  detail?: string;
}

interface CardBenefitProfile {
  cardId: string;
  annualCredits: AnnualCredit[];
  perks: Perk[];
  sweetSpots: string[];
  avoid: string[];
}

const BENEFIT_PROFILES: CardBenefitProfile[] = [
  // ── Chase Freedom Unlimited ──────────────────────────────────────────────
  {
    cardId: "cfu",
    annualCredits: [],
    perks: [
      { icon: Shield, label: "No annual fee", detail: "Free to hold indefinitely" },
      { icon: CreditCard, label: "0% intro APR", detail: "15 months on purchases & balance transfers" },
      { icon: Shield, label: "Purchase protection", detail: "Up to $500/claim, 120 days" },
      { icon: Shield, label: "Extended warranty", detail: "Adds 1 year to eligible warranties" },
      { icon: Plane, label: "No foreign transaction fee" },
    ],
    sweetSpots: [
      "Catch-all card: 1.5x on anything that doesn't have a better option",
      "3x dining pairs with CSP transfer access — keeps UR balance growing fee-free",
      "3x drugstore: Walgreens, CVS runs (easy 3x on everyday spend)",
    ],
    avoid: [
      "Using it when CSP earns higher (e.g. dining — both earn 3x, but CSP's UR is more valuable if you downgrade CFU)",
      "Portal bookings — no travel multiplier here",
    ],
  },

  // ── Chase Sapphire Preferred ─────────────────────────────────────────────
  {
    cardId: "csp",
    annualCredits: [
      { label: "Hotel credit (Chase Travel portal)", value: 50, note: "Statement credit on hotel stays booked via portal" },
      { label: "10% anniversary points bonus", value: 12, note: "~720 pts on avg spend → ~$12 at 1.7¢/pt" },
    ],
    perks: [
      { icon: Plane, label: "Transfer partners", detail: "Hyatt, United, Southwest, British Airways, Flying Blue, Turkish, Singapore & more" },
      { icon: Shield, label: "Primary rental car insurance", detail: "Covers collision/theft — skip the rental company CDW" },
      { icon: Shield, label: "Trip delay reimbursement", detail: "$500/ticket for delays 12+ hrs" },
      { icon: Shield, label: "Trip cancellation/interruption", detail: "$10,000/trip for covered reasons" },
      { icon: Shield, label: "Baggage delay", detail: "$100/day (5 days max) if baggage delayed 6+ hrs" },
      { icon: Plane, label: "No foreign transaction fee" },
    ],
    sweetSpots: [
      "Transfer to World of Hyatt: ~2.0¢/pt at mid-tier properties — best consistent UR value",
      "Transfer to United for domestic saver awards (esp. last-minute)",
      "3x dining + $50 hotel credit offset most of the $95 annual fee",
      "Primary rental car coverage saves $15–30/day vs. buying from Hertz/Enterprise",
    ],
    avoid: [
      "Portal bookings at 1.25¢/pt — transfer to partners instead for 1.7–2.0¢/pt",
      "Redeeming for cash back at 1¢/pt — always transfer or use portal minimum",
    ],
  },

  // ── Marriott Bonvoy Boundless ─────────────────────────────────────────────
  {
    cardId: "boundless",
    annualCredits: [
      { label: "Free Night Certificate (up to 35K pts)", value: 250, note: "Conservative $250 estimate; can be $400+ at premium Cat 5 properties" },
    ],
    perks: [
      { icon: Hotel, label: "15 Elite Night Credits/yr", detail: "Counts toward Gold (25 nights) or Platinum (50 nights) status — 1/3 of Gold from the card alone" },
      { icon: Star, label: "Silver Elite status", detail: "Auto 10% points bonus, late checkout (when available), priority customer service" },
      { icon: Gift, label: "Free Night Cert on account anniversary", detail: "Valid 12 months from issuance; must use at properties up to 35K pts" },
      { icon: Plane, label: "No foreign transaction fee" },
    ],
    sweetSpots: [
      "Category 4 properties (≤25K pts/night) — sweet spot for cert value, especially in secondary markets",
      "Use cert at Autograph Collection / Tribute Portfolio for boutique experience at chain pricing",
      "Stack 6x Marriott earn with promo offers for fast point accumulation at Bonvoy brands",
      "15 ENCs each year gets you 30 nights toward status if you also physically stay 15 nights",
    ],
    avoid: [
      "Paying the $95 fee if you won't use the free night cert — downgrade to Bold instead",
      "High-category redemptions (Cat 7: 85K/night) — certs are limited to 35K, and points CPP drops",
    ],
  },

  // ── Capital One Venture X ─────────────────────────────────────────────────
  {
    cardId: "venture_x",
    annualCredits: [
      { label: "$300 Capital One Travel credit", value: 300, note: "Use for any booking in the Cap1 Travel portal — flights, hotels, rental cars" },
      { label: "10,000 bonus miles on anniversary", value: 150, note: "~$150 at 1.5¢/pt CPP" },
    ],
    perks: [
      { icon: Plane, label: "Unlimited Priority Pass lounges", detail: "You + 2 guests; covers 1,300+ airport lounges worldwide" },
      { icon: CreditCard, label: "Global Entry / TSA PreCheck credit", detail: "Up to $100 credit every 4 years" },
      { icon: Star, label: "Capital One lounge access", detail: "Access to Capital One's own airport lounges (DFW, DEN, IAD)" },
      { icon: Shield, label: "Travel insurance suite", detail: "Trip cancellation, trip delay, lost luggage, rental car coverage" },
      { icon: Plane, label: "No foreign transaction fee" },
    ],
    sweetSpots: [
      "$300 travel credit + 10K anniversary miles = $450 in annual value vs. $395 fee → net positive on perks alone",
      "Transfer to Turkish Miles&Smiles: United domestic flights for ~7,500 miles (incredible value if availability exists)",
      "Transfer to Flying Blue: sweet spots to Europe ~30K miles one-way in economy",
      "2x on everything: strong catch-all when other cards don't have a category bonus",
      "Priority Pass: essential if you fly more than 2–3 times/year (lounge access alone worth $50–100+ per visit)",
    ],
    avoid: [
      "Earning miles and sitting on them — Cap1 has devalued partner ratios before; deploy within 12–18 months",
      "Hotel/car bookings outside the Cap1 portal (you lose 10x and may lose travel credit eligibility)",
    ],
  },
];

// ─── Category labels for the multiplier table ─────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  dining: "Dining",
  groceries: "Groceries",
  online_grocery: "Online Grocery",
  streaming: "Streaming",
  drugstore: "Drugstore",
  travel: "Travel (broad)",
  gas: "Gas",
  marriott: "Marriott Hotels",
  hotel: "Hotels",
  rental_car: "Rental Cars",
  flight: "Flights",
  other: "Everything else",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function MultiplierRow({
  category,
  multiplier,
  note,
}: {
  category: Category | "other";
  multiplier: number;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="w-8 text-center">
        <span
          className={`text-xs font-bold ${
            multiplier >= 5
              ? "text-primary"
              : multiplier >= 3
              ? "text-success"
              : "text-foreground"
          }`}
        >
          {multiplier}x
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">
          {CATEGORY_LABELS[category as Category] ?? category}
        </p>
        {note && <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

function PerkRow({ icon: Icon, label, detail }: Perk) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="w-6 flex justify-center">
        <Icon size={14} className="text-primary mt-0.5 shrink-0" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {open ? (
          <ChevronUp size={13} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground" />
        )}
      </button>
      {open && children}
    </div>
  );
}

function CardBenefitCard({ card }: { card: Card }) {
  const profile = BENEFIT_PROFILES.find((p) => p.cardId === card.id);
  const pointsBalance = POINTS_FULL.find(
    (b) =>
      (card.id === "cfu" && b.program === "chase_ur") ||
      (card.id === "csp" && b.program === "chase_ur") ||
      (card.id === "boundless" && b.program === "marriott_bonvoy") ||
      (card.id === "venture_x" && b.program === "capital_one")
  );

  const cpp = CPP[card.pointsProgram];
  const totalCreditValue = profile?.annualCredits.reduce((s, c) => s + c.value, 0) ?? 0;
  const netFee = card.annualFee - totalCreditValue;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-14 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: card.color, color: card.textColor }}
        >
          {card.shortName}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{card.issuer}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">
            {card.annualFee === 0 ? "Free" : `$${card.annualFee}/yr`}
          </p>
          {totalCreditValue > 0 && (
            <p className="text-[11px] text-success font-medium">
              net ${netFee > 0 ? netFee : 0}
            </p>
          )}
        </div>
      </div>

      {/* Value summary strip */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <DollarSign size={12} className="text-muted-foreground" />
          <span className="text-muted-foreground">CPP</span>
          <span className="font-semibold text-foreground">{cpp}¢/pt</span>
        </div>
        {pointsBalance && (
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-primary" />
            <span className="text-muted-foreground">Balance</span>
            <span className="font-semibold text-foreground">
              {pointsBalance.balance.toLocaleString()} pts
            </span>
            <span className="text-muted-foreground">
              (~${((pointsBalance.balance * cpp) / 100).toFixed(0)})
            </span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {profile && (
        <div className="px-4 pb-4">
          {/* Earn rates */}
          <CollapsibleSection title="Earn Rates" defaultOpen={true}>
            <div className="divide-y divide-border">
              {card.multipliers.map((m) => (
                <MultiplierRow
                  key={m.category}
                  category={m.category}
                  multiplier={m.multiplier}
                  note={m.note}
                />
              ))}
              <MultiplierRow
                category="other"
                multiplier={card.catchAllMultiplier}
                note="Catch-all for uncategorized spend"
              />
            </div>
          </CollapsibleSection>

          {/* Annual credits */}
          {profile.annualCredits.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <CollapsibleSection title="Annual Credits & Benefits" defaultOpen={true}>
                <div className="flex flex-col gap-2 mt-1">
                  {profile.annualCredits.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-success w-12 shrink-0">
                        +${c.value}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{c.label}</p>
                        {c.note && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{c.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Credits vs. ${card.annualFee} fee
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        netFee <= 0 ? "text-success" : "text-foreground"
                      }`}
                    >
                      Net: {netFee <= 0 ? "✓ Fee offset" : `$${netFee} net cost`}
                    </span>
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* Perks */}
          {profile.perks.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <CollapsibleSection title="Card Perks">
                <div className="divide-y divide-border">
                  {profile.perks.map((perk, i) => (
                    <PerkRow key={i} {...perk} />
                  ))}
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* Sweet spots */}
          {profile.sweetSpots.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <CollapsibleSection title="Sweet Spots">
                <ul className="flex flex-col gap-2 mt-1">
                  {profile.sweetSpots.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-foreground leading-snug">
                      <Star
                        size={11}
                        className="text-primary shrink-0 mt-0.5 fill-primary"
                      />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            </>
          )}

          {/* Avoid */}
          {profile.avoid.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <CollapsibleSection title="What to Avoid">
                <ul className="flex flex-col gap-2 mt-1">
                  {profile.avoid.map((a, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-snug">
                      <span className="text-destructive shrink-0 mt-0.5">✕</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BenefitsPage() {
  const totalFees = CARDS.reduce((s, c) => s + c.annualFee, 0);
  const totalCredits = BENEFIT_PROFILES.reduce(
    (s, p) => s + p.annualCredits.reduce((cs, c) => cs + c.value, 0),
    0
  );

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SubPageHeader
        title="Card Benefits"
        backHref="/strategy"
        subtitle={`$${totalFees}/yr in fees · ~$${totalCredits} in credits`}
      />

      {/* Summary strip */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-primary/20 bg-accent px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Annual fees
            </p>
            <p className="text-lg font-bold text-foreground">${totalFees}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Credits & perks
            </p>
            <p className="text-lg font-bold text-success">~${totalCredits}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Net cost
            </p>
            <p className="text-lg font-bold text-foreground">
              ${Math.max(0, totalFees - totalCredits)}
            </p>
          </div>
        </div>
      </div>

      {/* Card list */}
      <div className="px-4 flex flex-col gap-4">
        {CARDS.map((card) => (
          <CardBenefitCard key={card.id} card={card} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 mt-4">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          CPP values are conservative estimates.{" "}
          <Link href="/strategy" className="text-primary underline font-medium">
            Strategy Hub
          </Link>{" "}
          shows live transfer bonus alerts.
        </p>
      </div>
    </div>
  );
}
