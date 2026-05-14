"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function SettingsHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-6 pb-4">
      <Link
        href="/settings"
        className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
      >
        <ChevronLeft size={18} className="text-foreground" />
      </Link>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );
}
