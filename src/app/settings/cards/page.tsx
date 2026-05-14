"use client";

import { useState, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { CARDS } from "@/lib/cards";
import {
  loadCardMetadataFromDB,
  saveCardMetadataToDB,
  cardIsConfigured,
  type AllCardMetadata,
  type CardMetadata,
} from "@/lib/card-user-data";
import {
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyMeta(): Partial<CardMetadata> {
  return {
    openedDate: "",
    statementCloseDay: 0,
    dueDay: 0,
    creditLimit: 0,
    last4: "",
    active: true,
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  pattern,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  pattern?: string;
}) {
  return (
    <input
      type={type}
      value={value === 0 ? "" : value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      pattern={pattern}
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    />
  );
}

// ─── Per-card section ────────────────────────────────────────────────────────

function CardSection({
  card,
  meta,
  onChange,
  configured,
}: {
  card: (typeof CARDS)[0];
  meta: Partial<CardMetadata>;
  onChange: (patch: Partial<CardMetadata>) => void;
  configured: boolean;
}) {
  const [open, setOpen] = useState(!configured);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Card header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
      >
        <div
          className="w-12 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: card.color, color: card.textColor }}
        >
          {card.shortName}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {card.annualFee === 0 ? "No annual fee" : `$${card.annualFee}/yr`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {configured ? (
            <CheckCircle2 size={16} className="text-success" />
          ) : (
            <AlertTriangle size={15} className="text-warning" />
          )}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-4">
          {/* ── Account Info ─────────────────────────────────── */}
          <Section label="Account Info">
            <Field
              label="Date Opened"
              hint="The day you were approved / card arrived"
            >
              <TextInput
                type="date"
                value={meta.openedDate ?? ""}
                onChange={(v) => onChange({ openedDate: v })}
              />
            </Field>

            <Field label="Last 4 Digits">
              <TextInput
                value={meta.last4 ?? ""}
                onChange={(v) => onChange({ last4: v.replace(/\D/g, "").slice(0, 4) })}
                placeholder="1234"
                maxLength={4}
                pattern="[0-9]{4}"
              />
            </Field>

            <Field label="Credit Limit ($)" hint="Total limit, not available credit">
              <TextInput
                type="number"
                value={meta.creditLimit ?? ""}
                onChange={(v) => onChange({ creditLimit: Number(v) })}
                placeholder="10000"
              />
            </Field>
          </Section>

          {/* ── Billing Cycle ─────────────────────────────────── */}
          <Section label="Billing Cycle">
            <Field
              label="Statement Close Day"
              hint="Day of month your statement closes (e.g. 15)"
            >
              <TextInput
                type="number"
                value={meta.statementCloseDay ?? ""}
                onChange={(v) => {
                  const n = Math.min(31, Math.max(1, Number(v)));
                  onChange({ statementCloseDay: n || 0 });
                }}
                placeholder="15"
              />
            </Field>

            <Field
              label="Payment Due Day"
              hint="Day of month your minimum payment is due"
            >
              <TextInput
                type="number"
                value={meta.dueDay ?? ""}
                onChange={(v) => {
                  const n = Math.min(31, Math.max(1, Number(v)));
                  onChange({ dueDay: n || 0 });
                }}
                placeholder="8"
              />
            </Field>
          </Section>

          {/* ── Marriott-specific: Free Night Certs ────────────── */}
          {card.id === "boundless" && (
            <Section label="Free Night Certificates" accent>
              <Field
                label="Number of Valid Certs"
                hint="Certs you currently have and haven't used"
              >
                <TextInput
                  type="number"
                  value={meta.certCount ?? ""}
                  onChange={(v) =>
                    onChange({ certCount: Math.max(0, Number(v)) })
                  }
                  placeholder="5"
                />
              </Field>

              <Field
                label="Next Cert Expiry Date"
                hint="Expiry of your soonest-expiring cert"
              >
                <TextInput
                  type="date"
                  value={meta.certExpiry ?? ""}
                  onChange={(v) => onChange({ certExpiry: v })}
                />
              </Field>
            </Section>
          )}

          {/* Completion hint */}
          {!configured && (
            <p className="text-[11px] text-warning leading-snug flex items-start gap-1.5">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              Fill in all fields to unlock accurate renewal countdowns and payment alerts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
          accent ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyCardsPage() {
  const [meta, setMeta] = useState<AllCardMetadata>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadCardMetadataFromDB().then((stored) => {
      // Ensure every card has an entry so the form is pre-populated
      const withDefaults: AllCardMetadata = {};
      CARDS.forEach((c) => {
        withDefaults[c.id] = { ...emptyMeta(), ...(stored[c.id] ?? {}) };
      });
      setMeta(withDefaults);
      setLoaded(true);
    });
  }, []);

  function patchCard(cardId: string, patch: Partial<CardMetadata>) {
    setMeta((prev) => ({
      ...prev,
      [cardId]: { ...prev[cardId], ...patch },
    }));
  }

  async function handleSave() {
    setStatus("saving");
    await saveCardMetadataToDB(meta);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2500);
  }

  const configuredCount = loaded
    ? CARDS.filter((c) => cardIsConfigured(c.id, meta)).length
    : 0;

  return (
    <div className="flex flex-col min-h-screen pb-6 max-w-lg mx-auto">
      <SettingsHeader title="My Cards" />

      <div className="px-4 flex flex-col gap-4">
        {/* Intro banner */}
        <div className="rounded-2xl border border-primary/20 bg-accent px-4 py-3">
          <p className="text-xs font-semibold text-foreground mb-0.5">One-time setup</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your card details once to unlock accurate renewal countdowns, payment timing
            alerts, and utilization tracking. Cards expand automatically when info is missing.
          </p>
          {loaded && (
            <p className="text-xs text-primary font-medium mt-2">
              {configuredCount}/{CARDS.length} cards complete
            </p>
          )}
        </div>

        {loaded &&
          CARDS.map((card) => (
            <CardSection
              key={card.id}
              card={card}
              meta={meta[card.id] ?? {}}
              onChange={(patch) => patchCard(card.id, patch)}
              configured={cardIsConfigured(card.id, meta)}
            />
          ))}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={status !== "idle"}
          className="w-full rounded-xl bg-primary text-white py-3.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {status === "saving" && <Loader2 size={15} className="animate-spin" />}
          {status === "saved" && <Check size={15} />}
          {status === "idle" ? "Save All Cards" : status === "saving" ? "Saving…" : "Saved!"}
        </button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
          Saved securely to the cloud — available on all your devices.
        </p>
      </div>
    </div>
  );
}
