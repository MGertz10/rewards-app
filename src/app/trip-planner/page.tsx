import { Map } from "lucide-react";

export default function TripPlannerPage() {
  return (
    <div className="flex flex-col min-h-screen px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Trip Planner</h1>
        <p className="text-muted-foreground text-sm mt-1">Deploy your points</p>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <Map size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Trip Planner</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Plan trips, compare redemption options, and maximize your points. Coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
