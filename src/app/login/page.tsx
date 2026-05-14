"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    if (!res.ok) {
      setError("Wrong passcode. Try again.");
      setPasscode("");
      setLoading(false);
      return;
    }

    router.push("/optimizer");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 10C6 8.9 6.9 8 8 8h16c1.1 0 2 .9 2 2v2H6v-2z" fill="white" fillOpacity="0.9"/>
            <rect x="6" y="13" width="20" height="11" rx="1" fill="white" fillOpacity="0.15"/>
            <rect x="6" y="13" width="20" height="4" fill="white" fillOpacity="0.3"/>
            <circle cx="22" cy="20" r="3" fill="#F5A623"/>
            <circle cx="19" cy="20" r="3" fill="white" fillOpacity="0.6"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Rewards App</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your personal card optimizer</p>
        </div>
      </div>

      {/* Passcode form */}
      <div className="w-full max-w-xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground text-center">Enter your passcode</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                inputMode="numeric"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••"
                autoFocus
                required
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3 text-sm text-foreground text-center tracking-widest placeholder:text-muted-foreground placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full rounded-xl bg-primary text-white py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Unlocking…" : "Unlock"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your passcode is set in app settings
        </p>
      </div>
    </div>
  );
}
