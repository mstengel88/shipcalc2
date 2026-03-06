import { Truck, Package, ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShippingCostCalculator from "@/components/ShippingCostCalculator";
import MultiTruckCalculator from "@/components/MultiTruckCalculator";
import ShopifyShippingQuote from "@/components/ShopifyShippingQuote";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
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
        <Tabs defaultValue="shipping" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mx-auto">
            <TabsTrigger value="shipping" className="flex items-center gap-2 font-heading font-semibold">
              <Truck className="h-4 w-4" />
              Shipping Cost
            </TabsTrigger>
            <TabsTrigger value="multi-truck" className="flex items-center gap-2 font-heading font-semibold">
              <Package className="h-4 w-4" />
              Multi-Truck
            </TabsTrigger>
            <TabsTrigger value="shopify" className="flex items-center gap-2 font-heading font-semibold">
              <ShoppingBag className="h-4 w-4" />
              Shopify Quote
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shipping" className="max-w-2xl mx-auto">
            <ShippingCostCalculator />
          </TabsContent>

          <TabsContent value="multi-truck" className="max-w-2xl mx-auto">
            <MultiTruckCalculator />
          </TabsContent>

          <TabsContent value="shopify" className="max-w-2xl mx-auto">
            <ShopifyShippingQuote />
          </TabsContent>
        </Tabs>
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
