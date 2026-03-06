
import ShippingCostCalculator from "@/components/ShippingCostCalculator";

const Index = () => {
  return (
    <div className="min-h-screen bg-background dark">

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
