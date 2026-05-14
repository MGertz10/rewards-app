"use client";

import { useState, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Check, Loader2 } from "lucide-react";

const STORAGE_KEY = "rewards_profile";

interface Profile {
  name: string;
  age: string;
  city: string;
  currency: string;
}

const DEFAULTS: Profile = { name: "", age: "", city: "", currency: "USD" };

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setProfile({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  function set(key: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    setStatus("saving");
    await new Promise((r) => setTimeout(r, 300));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Profile" />

      <div className="px-4 flex flex-col gap-5">
        <Field
          label="Name"
          value={profile.name}
          onChange={(v) => set("name", v)}
          placeholder="Your name"
        />
        <Field
          label="Age"
          value={profile.age}
          onChange={(v) => set("age", v)}
          placeholder="25"
          type="number"
        />
        <Field
          label="Home City"
          value={profile.city}
          onChange={(v) => set("city", v)}
          placeholder="Chicago, IL"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Currency
          </label>
          <select
            value={profile.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="CAD">CAD — Canadian Dollar</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={status !== "idle"}
          className="w-full rounded-xl bg-primary text-white py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
        >
          {status === "saving" && <Loader2 size={15} className="animate-spin" />}
          {status === "saved" && <Check size={15} />}
          {status === "idle" ? "Save Profile" : status === "saving" ? "Saving…" : "Saved!"}
        </button>
      </div>
    </div>
  );
}
