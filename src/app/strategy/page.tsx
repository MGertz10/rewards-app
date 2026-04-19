import { Lightbulb } from "lucide-react";

export default function StrategyPage() {
  return (
    <div className="flex flex-col min-h-screen px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Strategy Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Offers, bonuses & card intel</p>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <Lightbulb size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Card Strategy Hub</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Transfer bonuses, sign-up offers, and annual fee analysis. Coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
