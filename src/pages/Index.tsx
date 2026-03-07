
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

    </div>
  );
};

export default Index;
