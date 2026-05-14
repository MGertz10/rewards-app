"use client";

import { useState } from "react";
import { SettingsHeader } from "@/components/settings-header";
import { Download, Trash2, CheckCircle2, Database, Eye, AlertTriangle } from "lucide-react";

const DATA_WE_STORE = [
  { label: "Profile info", detail: "Name, age, city — stored locally on device" },
  { label: "Card preferences", detail: "Which cards are active and annual fee dates — stored locally" },
  { label: "App preferences", detail: "Travel style, goals, notification settings — stored locally" },
  { label: "Auth session", detail: "Encrypted auth token via Supabase (no passwords stored)" },
];

const DATA_WE_NEVER_STORE = [
  "Account numbers or routing numbers",
  "Credit card numbers or CVVs",
  "Social security numbers",
  "Full transaction history (Plaid data is read-only and not cached)",
];

export default function PrivacyPage() {
  const [exportDone, setExportDone] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleExport() {
    const keys = [
      "rewards_profile",
      "rewards_card_prefs",
      "rewards_preferences",
      "rewards_notifications",
      "rewards_security",
    ];

    const data: Record<string, unknown> = {};
    keys.forEach((key) => {
      try {
        const val = localStorage.getItem(key);
        if (val) data[key] = JSON.parse(val);
      } catch {}
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rewards-app-data-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  }

  function handleDeleteAll() {
    const keys = [
      "rewards_profile",
      "rewards_card_prefs",
      "rewards_preferences",
      "rewards_notifications",
      "rewards_security",
    ];
    keys.forEach((key) => localStorage.removeItem(key));
    setShowDeleteConfirm(false);
    // Redirect to settings root
    window.location.href = "/settings";
  }

  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="Data & Privacy" />

      <div className="px-4 flex flex-col gap-5">
        {/* What we store */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            What we store
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {DATA_WE_STORE.map(({ label, detail }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-0.5">
                  <Database size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What we never store */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            We never store
          </p>
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
            {DATA_WE_NEVER_STORE.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Your data
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                {exportDone ? (
                  <CheckCircle2 size={18} className="text-success" />
                ) : (
                  <Download size={18} className="text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {exportDone ? "Downloaded!" : "Export My Data"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Download a JSON file of all stored data</p>
              </div>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Delete All Data</p>
                <p className="text-xs text-muted-foreground mt-0.5">Permanently erase all locally stored data</p>
              </div>
            </button>
          </div>
        </div>

        {/* View data inline button */}
        <button
          onClick={() => {
            const keys = ["rewards_profile","rewards_card_prefs","rewards_preferences","rewards_notifications","rewards_security"];
            const out: Record<string, unknown> = {};
            keys.forEach(k => { try { const v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch {} });
            alert(JSON.stringify(out, null, 2));
          }}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <Eye size={13} />
          View raw stored data
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-8">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Delete all data?</p>
                <p className="text-xs text-muted-foreground mt-0.5">This can't be undone.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All locally stored preferences, profile info, and card settings will be permanently erased. Your Supabase account will remain active.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 rounded-xl bg-destructive text-white py-3 text-sm font-semibold hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
