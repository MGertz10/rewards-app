import { SettingsHeader } from "@/components/settings-header";
import { ExternalLink, Heart, Code2, Star } from "lucide-react";

const CHANGELOG = [
  {
    version: "0.1.0",
    date: "April 2026",
    notes: [
      "Card Optimizer with merchant search and auto-detection",
      "Support for CFU, CSP, Marriott Boundless, and Venture X",
      "Quick Picks for common merchants",
      "Full Settings with profile, preferences, and notifications",
      "Light / dark / system theme support",
      "PWA — add to home screen on iOS and Android",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen pb-4 max-w-lg mx-auto">
      <SettingsHeader title="About" />

      <div className="px-4 flex flex-col gap-5">
        {/* App identity */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 10C6 8.9 6.9 8 8 8h16c1.1 0 2 .9 2 2v2H6v-2z" fill="white" fillOpacity="0.9" />
              <rect x="6" y="13" width="20" height="11" rx="1" fill="white" fillOpacity="0.15" />
              <rect x="6" y="13" width="20" height="4" fill="white" fillOpacity="0.3" />
              <circle cx="22" cy="20" r="3" fill="#F5A623" />
              <circle cx="19" cy="20" r="3" fill="white" fillOpacity="0.6" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Rewards App</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Version 0.1.0</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            A personal credit card rewards optimizer built for one person who wants every dollar to work harder.
          </p>
        </div>

        {/* Changelog */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Changelog
          </p>
          {CHANGELOG.map((release) => (
            <div key={release.version} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">v{release.version}</span>
                  <span className="text-[10px] font-semibold text-primary bg-accent px-1.5 py-0.5 rounded-full">
                    Current
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {release.notes.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-xs text-foreground">
                    <Star size={11} className="text-gold mt-0.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          <a
            href="mailto:feedback@example.com"
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Heart size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Send Feedback</p>
              <p className="text-xs text-muted-foreground mt-0.5">Found a bug or have a feature idea?</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground shrink-0" />
          </a>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Code2 size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Source Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">View on GitHub</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground shrink-0" />
          </a>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          Built with Claude Code · Vercel · Supabase · Next.js
        </p>
      </div>
    </div>
  );
}
