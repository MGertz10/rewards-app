"use client";

import { useState, useEffect } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Check, Loader2, Fingerprint, Lock, Clock, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "rewards_security";

interface SecuritySettings {
  biometricEnabled: boolean;
  sessionTimeout: "5" | "15" | "30" | "60" | "never";
}

const DEFAULTS: SecuritySettings = {
  biometricEnabled: false,
  sessionTimeout: "15",
};

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

export default function SecurityPage() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}

    // Check if WebAuthn / biometric is supported
    if (
      typeof window !== "undefined" &&
      window.PublicKeyCredential !== undefined
    ) {
      setBiometricSupported(true);
    }
  }, []);

  function set<K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
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
      <SettingsHeader title="Security" />

      <div className="px-4 flex flex-col gap-5">
        {/* Passcode */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            App Lock
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Lock size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Set Passcode</p>
                <p className="text-xs text-muted-foreground mt-0.5">4-digit PIN to lock the app</p>
              </div>
              <span className="text-xs text-muted-foreground">Not set</span>
            </button>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Fingerprint size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Face ID / Biometric</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {biometricSupported
                    ? "Use biometric to unlock instead of passcode"
                    : "Not supported on this device"}
                </p>
              </div>
              <Toggle
                checked={settings.biometricEnabled && biometricSupported}
                onChange={(v) => biometricSupported && set("biometricEnabled", v)}
              />
            </div>
          </div>
        </div>

        {/* Session timeout */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Auto-Lock
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {(
              [
                { value: "5", label: "After 5 minutes" },
                { value: "15", label: "After 15 minutes" },
                { value: "30", label: "After 30 minutes" },
                { value: "60", label: "After 1 hour" },
                { value: "never", label: "Never" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("sessionTimeout", opt.value)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-primary" />
                </div>
                <p className="flex-1 text-sm font-medium text-foreground">{opt.label}</p>
                {settings.sessionTimeout === opt.value && (
                  <Check size={16} className="text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div className="rounded-xl bg-accent border border-primary/20 p-4 flex gap-3">
          <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Your data stays private</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              No financial account numbers or routing numbers are stored. All connected data uses read-only OAuth tokens encrypted at rest.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={status !== "idle"}
          className="w-full rounded-xl bg-primary text-white py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {status === "saving" && <Loader2 size={15} className="animate-spin" />}
          {status === "saved" && <Check size={15} />}
          {status === "idle" ? "Save Security Settings" : status === "saving" ? "Saving…" : "Saved!"}
        </button>
      </div>
    </div>
  );
}
