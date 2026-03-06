import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Truck, DollarSign, Fuel, Route } from "lucide-react";
import { TRUCK_TYPES, calculateShippingCost, getZoneByDistance, type TruckType } from "@/lib/shipping-data";

interface ShippingResult {
  baseCost: number;
  fuelSurcharge: number;
  total: number;
  zone: string;
  truck: TruckType;
}

const ShippingCostCalculator = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [result, setResult] = useState<ShippingResult | null>(null);

  const handleCalculate = () => {
    const distanceMiles = parseFloat(distance);
    const weightLbs = parseFloat(weight);
    const truck = TRUCK_TYPES.find((t) => t.id === selectedTruck);

    if (!distanceMiles || !weightLbs || !truck) return;

    const costs = calculateShippingCost(distanceMiles, weightLbs, truck);
    const zone = getZoneByDistance(distanceMiles);

    setResult({
      ...costs,
      zone: zone.name,
      truck,
    });
  };

  return (
    <Card className="border-2">
      <CardHeader className="border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="font-heading text-xl">Shipping Cost Calculator</CardTitle>
            <CardDescription>Calculate delivery costs based on distance and load</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Origin Address
            </Label>
            <Input
              placeholder="e.g. 123 Main St, Dallas TX"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 text-accent" /> Delivery Address
            </Label>
            <Input
              placeholder="e.g. 456 Oak Ave, Houston TX"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Route className="h-3.5 w-3.5 text-muted-foreground" /> Distance (miles)
            </Label>
            <Input
              type="number"
              placeholder="e.g. 120"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Load Weight (lbs)</Label>
            <Input
              type="number"
              placeholder="e.g. 15000"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" /> Truck Type
            </Label>
            <Select value={selectedTruck} onValueChange={setSelectedTruck}>
              <SelectTrigger>
                <SelectValue placeholder="Select truck" />
              </SelectTrigger>
              <SelectContent>
                {TRUCK_TYPES.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    {truck.icon} {truck.name} ({truck.maxWeight.toLocaleString()} lbs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!distance || !weight || !selectedTruck}
          className="w-full font-heading text-base font-semibold tracking-wide"
          size="lg"
        >
          <DollarSign className="mr-2 h-5 w-5" />
          Calculate Shipping Cost
        </Button>

        {result && (
          <div className="rounded-xl border-2 border-primary/20 bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Shipping Zone</span>
              <span className="font-mono text-sm font-semibold">{result.zone}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Truck</span>
              <span className="font-mono text-sm">{result.truck.icon} {result.truck.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Base Cost</span>
              <span className="font-mono text-sm">${result.baseCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Fuel className="h-3.5 w-3.5" /> Fuel Surcharge
              </span>
              <span className="font-mono text-sm text-warning">${result.fuelSurcharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-lg font-heading font-bold">Total Cost</span>
              <span className="font-mono text-2xl font-bold text-primary">${result.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShippingCostCalculator;
