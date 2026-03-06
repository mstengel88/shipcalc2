import { Truck } from "lucide-react";
import ShippingCostCalculator from "@/components/ShippingCostCalculator";

const Index = () => {
  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header className="border-b-2 border-border bg-surface/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                ShipCalc Pro
              </h1>
              <p className="text-sm text-muted-foreground">
                Bulk material shipping & multi-truck logistics calculator
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <ShippingCostCalculator />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/30 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Rates are estimates. Actual costs may vary based on fuel prices, road conditions, and availability.
        </div>
      </footer>
    </div>
  );
};

export default Index;
