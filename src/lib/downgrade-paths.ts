// Card downgrade path definitions.
// A "downgrade" is a product change to a lower (or no) annual fee card
// that preserves your account history (no new hard inquiry, no impact on
// average age of accounts or 5/24 status).
//
// This data is hand-curated. Update when issuer policy changes.

export interface DowngradeStep {
  label: string;
  detail?: string;
}

export interface DowngradePath {
  /** Source card id (matches CARDS in /lib/cards.ts) */
  fromCardId: string;
  fromName: string;
  fromAnnualFee: number;

  /** Target card id (may not exist in CARDS yet — informational) */
  toCardId: string;
  toName: string;
  toAnnualFee: number;

  /** Does this preserve account history (no new credit pull)? */
  preserveHistory: boolean;

  /** Things to use up before downgrading */
  preDowngradeChecklist: { id: string; label: string; warning?: string }[];

  /** Things you keep / lose after downgrade */
  whatYouKeep: string[];
  whatYouLose: string[];

  /** Phone script — what to ask the rep */
  phoneScript: { phone: string; steps: DowngradeStep[] };

  /** Optimal timing guidance */
  timing: string[];

  /** Anything that could go wrong */
  gotchas: string[];
}

export const DOWNGRADE_PATHS: Record<string, DowngradePath> = {
  // ─── Marriott Bonvoy Boundless → Bonvoy Bold (the launch case) ───────────
  boundless: {
    fromCardId: "boundless",
    fromName: "Marriott Bonvoy Boundless",
    fromAnnualFee: 95,

    toCardId: "bonvoy_bold",
    toName: "Marriott Bonvoy Bold",
    toAnnualFee: 0,

    preserveHistory: true,

    preDowngradeChecklist: [
      {
        id: "use_free_night_cert",
        label: "Use this year's Free Night Certificate (up to 35K points)",
        warning:
          "Bonvoy Bold does NOT come with a free night cert. If you've already received this year's cert and haven't used it, BURN IT FIRST. Cert typically expires 12 months after issuance.",
      },
      {
        id: "deplete_marriott_balance_optional",
        label: "Optional: deplete Marriott points if you don't plan to use them",
        warning:
          "Marriott points stay on your account regardless of which card you hold. Skip this unless you're closing all Marriott cards.",
      },
      {
        id: "wait_until_after_anniversary",
        label: "Wait until just AFTER your account anniversary",
        warning:
          "If the $95 fee already posted this cycle, downgrade ASAP — Chase will refund the fee within 30-45 days of charge. If the fee has NOT posted yet, downgrade before it does.",
      },
    ],

    whatYouKeep: [
      "Account history & average age (no new account opened)",
      "Existing Marriott points balance",
      "Any unredeemed Free Night Certificates already issued",
      "Silver Elite status for the year",
      "1x earn on most spend (Bold earns 1x; Boundless earned 2x)",
    ],

    whatYouLose: [
      "Annual Free Night Certificate (Bold doesn't get one)",
      "15 Elite Night Credits/yr → drops to 5",
      "Higher earn rates (6x Marriott, 3x dining/grocery/gas → 3x Marriott, 2x dining/groceries, 1x other)",
      "Auto-renewal of Silver status (Bold gives 5 ENCs, not auto-Silver)",
    ],

    phoneScript: {
      phone: "1-800-432-3117",
      steps: [
        {
          label: "Call Chase",
          detail: "Authenticate with the rep — full name, last 4 of card, address.",
        },
        {
          label: "Ask: 'I'd like to do a product change from Bonvoy Boundless to Bonvoy Bold.'",
          detail:
            "The phrase 'product change' is important — it means 'keep my account, just swap the card type.'",
        },
        {
          label: "Confirm: 'Will this be a hard pull or soft pull?'",
          detail:
            "Should be a SOFT pull (no credit score impact). If they say hard pull, ask to escalate or hang up and try again.",
        },
        {
          label: "Confirm: 'Will my account history and opening date be preserved?'",
          detail: "Yes — that's the whole point of a product change vs. cancellation.",
        },
        {
          label: "Ask about the annual fee refund (if applicable)",
          detail:
            "If the $95 fee has already posted in the last 30-45 days, ask for a prorated refund. Chase usually obliges within this window.",
        },
        {
          label: "Confirm new card details",
          detail:
            "Same account number? (Usually yes for product changes.) When will the new card arrive? (Typically 7-10 days.)",
        },
      ],
    },

    timing: [
      "Best time: just after your account anniversary, AFTER you've used your free night cert.",
      "Acceptable: within 30-45 days of the $95 fee posting (still refundable).",
      "Bad time: right before your anniversary if you haven't used this year's cert yet.",
    ],

    gotchas: [
      "If you've never used a free night cert at a high-value property (Cat 5+), the cert can be worth $250-$500. Don't downgrade until you've redeemed it.",
      "After downgrade, you cannot product-change BACK to Boundless without applying fresh (which is a new account, hard pull, and may be blocked by 5/24).",
      "Chase 5/24 rule: even though product changes don't count toward 5/24, opening any new Chase card while on Bold may still hit the 5/24 limit.",
      "Bold has a 24-month rule: you can only earn the SUB once per lifetime per Marriott Chase card.",
    ],
  },

  // ─── Chase Sapphire Preferred → Chase Freedom Unlimited ───────────────────
  csp: {
    fromCardId: "csp",
    fromName: "Chase Sapphire Preferred",
    fromAnnualFee: 95,
    toCardId: "cfu",
    toName: "Chase Freedom Unlimited",
    toAnnualFee: 0,
    preserveHistory: true,
    preDowngradeChecklist: [
      {
        id: "transfer_or_redeem_ur",
        label: "Transfer or redeem any Chase UR points you want at premium value",
        warning:
          "CFU on its own only redeems at 1¢/pt. To keep the 1.25¢ portal value or transfer to partners, you need ANOTHER premium Chase card (CSR, Ink Preferred). If CSP is your only premium card, transfer points BEFORE downgrading.",
      },
    ],
    whatYouKeep: ["Account history", "Existing UR balance (but at 1¢/pt unless paired with another premium)"],
    whatYouLose: [
      "1.25¢/pt portal redemptions",
      "Transfer partners (Hyatt, United, etc.) — unless paired with another premium Chase card",
      "Travel insurance (CSP has primary rental car coverage)",
      "10% anniversary bonus on UR earned",
    ],
    phoneScript: {
      phone: "1-800-432-3117",
      steps: [
        { label: "Call Chase, authenticate" },
        { label: "Ask for 'product change from Sapphire Preferred to Freedom Unlimited'" },
        { label: "Confirm soft pull, account history preserved" },
        { label: "Ask about $95 fee refund if recently charged" },
      ],
    },
    timing: ["Only downgrade if you have CSR or Ink Preferred to keep transfer access — otherwise points become 1¢/pt only."],
    gotchas: [
      "5/24 implications: must wait 48 months from CSP signup before applying for CSR.",
      "Don't downgrade if CSP is your only Chase UR-earning premium card and you have transferable points.",
    ],
  },
};

/** Get a downgrade path by source card id. Returns null if no path exists. */
export function getDowngradePath(cardId: string): DowngradePath | null {
  return DOWNGRADE_PATHS[cardId] ?? null;
}
