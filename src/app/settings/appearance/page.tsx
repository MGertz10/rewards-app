"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Sun, Moon, Monitor, Check } from "lucide-react";

const OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Always use light mode",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use dark mode",
    icon: Moon,
  },
  {
    value: "system",
    label: "System Default",
    description: "Match your device setting",
    icon: Monitor,
  },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
        <SettingsHeader title="Appearance" />
        <div className="px-4 flex flex-col gap-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Appearance" />

      <div className="px-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground px-1">
          Choose how Rewards App looks. System default follows your iPhone or device setting.
        </p>

        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {OPTIONS.map(({ value, label, description, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    active ? "bg-primary text-white" : "bg-accent text-primary"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                {active && <Check size={16} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Preview card */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">CFU</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Chase Freedom Unlimited</p>
              <p className="text-xs text-muted-foreground">3x dining · 1.5x everything else</p>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Est. value on $50 dining</span>
            <span className="text-sm font-bold text-foreground">$0.26</span>
          </div>
        </div>
      </div>
    </div>
  );
}
