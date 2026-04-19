import { CreditCard, Zap } from "lucide-react";

export default function OptimizerPage() {
  return (
    <div className="flex flex-col min-h-screen px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Card Optimizer</h1>
        <p className="text-muted-foreground text-sm mt-1">Which card should I use?</p>
      </div>

      {/* Search / Category Input */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex items-center gap-3">
        <Zap size={20} className="text-primary shrink-0" />
        <p className="text-muted-foreground text-sm">
          Enter a merchant or category to find your best card...
        </p>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <CreditCard size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Daily Card Optimizer</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Instantly find the best card for any purchase. Coming in the next build.
          </p>
        </div>
      </div>
    </div>
  );
}
