"use client";

import { useState, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Check, Loader2 } from "lucide-react";

const STORAGE_KEY = "rewards_notifications";

interface NotifSettings {
  transferBonuses: boolean;
  subOffers: boolean;
  devaluationWarnings: boolean;
  mistakeFares: boolean;
  annualFeeReminders: boolean;
  weeklyDigest: boolean;
}

const DEFAULTS: NotifSettings = {
  transferBonuses: true,
  subOffers: true,
  devaluationWarnings: true,
  mistakeFares: false,
  annualFeeReminders: true,
  weeklyDigest: false,
};

const NOTIF_CONFIG: {
  key: keyof NotifSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "transferBonuses",
    label: "Transfer Bonuses",
    description: "When airlines or hotels offer a bonus on point transfers (e.g. Chase → Hyatt +30%)",
  },
  {
    key: "subOffers",
    label: "Sign-Up Bonus Offers",
    description: "New or elevated SUBs on cards that match your spend profile",
  },
  {
    key: "devaluationWarnings",
    label: "Devaluation Warnings",
    description: "When a program announces upcoming devaluation so you can redeem before it hits",
  },
  {
    key: "mistakeFares",
    label: "Mistake Fares & Flash Sales",
    description: "Error fares and flash point sales for your common routes",
  },
  {
    key: "annualFeeReminders",
    label: "Annual Fee Reminders",
    description: "Remind me 30 days before each card's annual fee posts",
  },
  {
    key: "weeklyDigest",
    label: "Weekly Digest",
    description: "A Sunday summary of your points earned, best offers, and travel intel",
  },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-muted border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  function toggle(key: keyof NotifSettings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleSave() {
    setStatus("saving");
    await new Promise((r) => setTimeout(r, 300));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Notifications" />

      <div className="px-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground px-1">
          Choose which alerts matter to you. Push notifications require installing the app to your home screen.
        </p>

        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {NOTIF_CONFIG.map(({ key, label, description }) => (
            <div key={key} className="flex items-center gap-3 px-4 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
              </div>
              <Toggle checked={settings[key]} onChange={() => toggle(key)} />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={status !== "idle"}
          className="w-full rounded-xl bg-primary text-white py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {status === "saving" && <Loader2 size={15} className="animate-spin" />}
          {status === "saved" && <Check size={15} />}
          {status === "idle" ? "Save Notifications" : status === "saving" ? "Saving…" : "Saved!"}
        </button>
      </div>
    </div>
  );
}
