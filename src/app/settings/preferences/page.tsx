"use client";

import { useState, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Check, Loader2 } from "lucide-react";

const STORAGE_KEY = "rewards_preferences";

interface Preferences {
  travelStyle: "value" | "balanced" | "luxury";
  primaryGoal: "travel" | "cashback" | "hybrid";
  riskTolerance: "conservative" | "moderate" | "aggressive";
  preferredAirline: string;
  preferredHotel: string;
}

const DEFAULTS: Preferences = {
  travelStyle: "value",
  primaryGoal: "travel",
  riskTolerance: "moderate",
  preferredAirline: "none",
  preferredHotel: "marriott",
};

function RadioGroup<T extends string>({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; sub?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div
              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                value === opt.value ? "border-primary bg-primary" : "border-border"
              }`}
            >
              {value === opt.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{opt.label}</p>
              {opt.sub && <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPrefs({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    setStatus("saving");
    await new Promise((r) => setTimeout(r, 300));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Preferences" />

      <div className="px-4 flex flex-col gap-6">
        <RadioGroup
          label="Travel Style"
          description="This shapes how we rank redemption options"
          value={prefs.travelStyle}
          onChange={(v) => set("travelStyle", v)}
          options={[
            { value: "value", label: "Value First", sub: "4–5 solid economy trips over one luxury splurge" },
            { value: "balanced", label: "Balanced", sub: "Mix of value and comfort depending on the trip" },
            { value: "luxury", label: "Luxury", sub: "Premium cabins and top hotels when the math works" },
          ]}
        />

        <RadioGroup
          label="Primary Goal"
          value={prefs.primaryGoal}
          onChange={(v) => set("primaryGoal", v)}
          options={[
            { value: "travel", label: "Travel Rewards", sub: "Maximize points for flights and hotels" },
            { value: "cashback", label: "Cash Back", sub: "Maximize dollar-value returns" },
            { value: "hybrid", label: "Hybrid", sub: "Balance travel rewards with flexibility" },
          ]}
        />

        <RadioGroup
          label="Risk Tolerance"
          description="How open are you to applying for new cards?"
          value={prefs.riskTolerance}
          onChange={(v) => set("riskTolerance", v)}
          options={[
            { value: "conservative", label: "Conservative", sub: "Only flag cards with clear, certain value" },
            { value: "moderate", label: "Moderate", sub: "Flag strong offers even if they require planning" },
            { value: "aggressive", label: "Aggressive", sub: "Surface all high-value SUBs, I'll decide" },
          ]}
        />

        <SelectField
          label="Preferred Airline"
          value={prefs.preferredAirline as string}
          onChange={(v) => set("preferredAirline", v)}
          options={[
            { value: "none", label: "No preference" },
            { value: "united", label: "United Airlines" },
            { value: "delta", label: "Delta Air Lines" },
            { value: "american", label: "American Airlines" },
            { value: "southwest", label: "Southwest" },
            { value: "alaska", label: "Alaska Airlines" },
          ]}
        />

        <SelectField
          label="Preferred Hotel"
          value={prefs.preferredHotel as string}
          onChange={(v) => set("preferredHotel", v)}
          options={[
            { value: "none", label: "No preference" },
            { value: "marriott", label: "Marriott Bonvoy" },
            { value: "hilton", label: "Hilton Honors" },
            { value: "hyatt", label: "World of Hyatt" },
            { value: "ihg", label: "IHG One Rewards" },
            { value: "wyndham", label: "Wyndham Rewards" },
          ]}
        />

        <button
          onClick={handleSave}
          disabled={status !== "idle"}
          className="w-full rounded-xl bg-primary text-white py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 mt-1"
        >
          {status === "saving" && <Loader2 size={15} className="animate-spin" />}
          {status === "saved" && <Check size={15} />}
          {status === "idle" ? "Save Preferences" : status === "saving" ? "Saving…" : "Saved!"}
        </button>
      </div>
    </div>
  );
}
