"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, CreditCard, Plane, Settings } from "lucide-react";

const tabs = [
  { href: "/dashboard",    label: "Dashboard", icon: LayoutDashboard },
  { href: "/strategy",     label: "Cards",     icon: CreditCard },
  { href: "/trip-planner", label: "Travel",    icon: Plane },
  { href: "/settings",     label: "Settings",  icon: Settings },
];

// Fetches unread alert count once per session and caches in sessionStorage.
function useUnreadAlertCount(): number {
  const SESSION_KEY = "unread_alert_count";
  const [count, setCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const cached = sessionStorage.getItem(SESSION_KEY);
    return cached ? parseInt(cached, 10) : 0;
  });

  useEffect(() => {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached !== null) return;
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(({ alerts }) => {
        const n = (alerts ?? []).length;
        sessionStorage.setItem(SESSION_KEY, String(n));
        setCount(n);
      })
      .catch(() => {});
  }, []);

  return count;
}

export function clearAlertBadge() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("unread_alert_count", "0");
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const unreadCount = useUnreadAlertCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const isCards = href === "/strategy";
          const showBadge = isCards && unreadCount > 0 && !active;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-0 ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-white leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? "text-primary" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
