import {
  User,
  CreditCard,
  SlidersHorizontal,
  Link2,
  Bell,
  Moon,
  Shield,
  Database,
  Info,
  ChevronRight,
} from "lucide-react";

const sections = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", description: "Name, age, home city" },
      { icon: CreditCard, label: "My Cards", description: "Add, edit, or remove cards" },
      { icon: SlidersHorizontal, label: "Preferences", description: "Travel style, goals, airlines & hotels" },
    ],
  },
  {
    title: "Connections",
    items: [
      { icon: Link2, label: "Connected Accounts", description: "Plaid, Google Sheets" },
    ],
  },
  {
    title: "App",
    items: [
      { icon: Bell, label: "Notifications", description: "Transfer bonuses, SUB offers, devaluations" },
      { icon: Moon, label: "Appearance", description: "Light, dark, or system default" },
    ],
  },
  {
    title: "Security & Privacy",
    items: [
      { icon: Shield, label: "Security", description: "Passcode, biometric, session timeout" },
      { icon: Database, label: "Data & Privacy", description: "View data, export, delete account" },
    ],
  },
  {
    title: "About",
    items: [
      { icon: Info, label: "About", description: "Version, changelog, feedback" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen pb-4">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-6 px-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </p>
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {section.items.map(({ icon: Icon, label, description }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
