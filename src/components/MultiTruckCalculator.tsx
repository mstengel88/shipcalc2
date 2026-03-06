import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Package, Calculator, Weight, ArrowRight } from "lucide-react";
import {
  TRUCK_TYPES,
  MATERIAL_TYPES,
  calculateMultiTruckSplit,
  type TruckAllocation,
  type MaterialType,
} from "@/lib/shipping-data";

const MultiTruckCalculator = () => {
  const [totalVolume, setTotalVolume] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [distance, setDistance] = useState("");
  const [preferredTruck, setPreferredTruck] = useState("");
  const [allocations, setAllocations] = useState<TruckAllocation[]>([]);
  const [material, setMaterial] = useState<MaterialType | null>(null);

  const handleCalculate = () => {
    const vol = parseFloat(totalVolume);
    const dist = parseFloat(distance);
    const mat = MATERIAL_TYPES.find((m) => m.id === selectedMaterial);

    if (!vol || !dist || !mat) return;

    setMaterial(mat);
    const results = calculateMultiTruckSplit(vol, mat, dist, preferredTruck || undefined);
    setAllocations(results);
  };

  const totalCost = allocations.reduce((sum, a) => sum + a.totalCost, 0);
  const totalLoads = allocations.reduce((sum, a) => sum + a.loads, 0);
  const totalWeight = material ? parseFloat(totalVolume) * material.weightPerUnit : 0;

  const groupedMaterials = MATERIAL_TYPES.reduce(
    (acc, mat) => {
      if (!acc[mat.category]) acc[mat.category] = [];
      acc[mat.category].push(mat);
      return acc;
    },
    {} as Record<string, MaterialType[]>
  );

  return (
    <Card className="border-2">
      <CardHeader className="border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Truck className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <CardTitle className="font-heading text-xl">Multi-Truck Split Calculator</CardTitle>
            <CardDescription>Optimize truck loads for bulk material deliveries</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-3.5 w-3.5 text-primary" /> Material Type
            </Label>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedMaterials).map(([category, materials]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>
                    {materials.map((mat) => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.name} ({mat.weightPerUnit.toLocaleString()} lbs/yd³)
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Weight className="h-3.5 w-3.5 text-muted-foreground" /> Total Volume (cubic yards)
            </Label>
            <Input
              type="number"
              placeholder="e.g. 100"
              value={totalVolume}
              onChange={(e) => setTotalVolume(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Distance (miles)</Label>
            <Input
              type="number"
              placeholder="e.g. 75"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" /> Preferred Truck (optional)
            </Label>
            <Select value={preferredTruck} onValueChange={setPreferredTruck}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-optimize" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-optimize</SelectItem>
                {TRUCK_TYPES.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    {truck.icon} {truck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!totalVolume || !selectedMaterial || !distance}
          className="w-full font-heading text-base font-semibold tracking-wide"
          size="lg"
        >
          <Calculator className="mr-2 h-5 w-5" />
          Calculate Truck Split
        </Button>

        {allocations.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Loads</p>
                <p className="font-mono text-2xl font-bold text-primary">{totalLoads}</p>
              </div>
              <div className="rounded-lg bg-secondary/10 border border-secondary/20 p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Weight</p>
                <p className="font-mono text-lg font-bold text-secondary">{(totalWeight / 2000).toFixed(1)}T</p>
              </div>
              <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cost</p>
                <p className="font-mono text-xl font-bold text-accent">${totalCost.toFixed(2)}</p>
              </div>
            </div>

            {/* Truck breakdown */}
            <div className="space-y-3">
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Load Breakdown
              </h4>
              {allocations.map((alloc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border-2 border-border bg-surface p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{alloc.truckType.icon}</span>
                      <div>
                        <p className="font-heading font-semibold">{alloc.truckType.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Max: {alloc.truckType.maxVolume} yd³ / {alloc.truckType.maxWeight.toLocaleString()} lbs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                      <span className="font-mono text-sm font-bold text-primary">{alloc.loads} loads</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Per Load</p>
                      <p className="font-mono font-medium">{alloc.volumePerLoad} yd³</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Weight/Load</p>
                      <p className="font-mono font-medium">{alloc.weightPerLoad.toLocaleString()} lbs</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cost/Load</p>
                      <p className="font-mono font-medium">${alloc.costPerLoad.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      Subtotal <ArrowRight className="h-3 w-3" />
                    </span>
                    <span className="font-mono font-bold text-foreground">${alloc.totalCost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultiTruckCalculator;
