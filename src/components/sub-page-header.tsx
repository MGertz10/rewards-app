"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Generic sub-page header with back chevron + title.
 * Used by Strategy sub-pages (calendar, burn, downgrade, etc.)
 * and Settings sub-pages. Pass `backHref` to control back navigation.
 */
export function SubPageHeader({
  title,
  backHref,
  subtitle,
}: {
  title: string;
  backHref: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 pt-6 pb-4">
      <Link
        href={backHref}
        className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0 mt-0.5"
        aria-label="Back"
      >
        <ChevronLeft size={18} className="text-foreground" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
