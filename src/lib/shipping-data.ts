// Shipping zones and rate data
export interface ShippingZone {
  id: string;
  name: string;
  states: string[];
  baseRate: number; // per mile
  fuelSurcharge: number; // percentage
  minCharge: number;
}

export interface TruckType {
  id: string;
  name: string;
  maxWeight: number; // lbs
  maxVolume: number; // cubic yards
  costPerMile: number;
  flatFee: number;
  icon: string;
}

export interface MaterialType {
  id: string;
  name: string;
  weightPerUnit: number; // lbs per cubic yard
  category: string;
}

export const SHIPPING_ZONES: ShippingZone[] = [
  { id: "local", name: "Local (0-50 mi)", states: [], baseRate: 3.50, fuelSurcharge: 0.15, minCharge: 150 },
  { id: "regional", name: "Regional (50-200 mi)", states: [], baseRate: 2.80, fuelSurcharge: 0.18, minCharge: 350 },
  { id: "long", name: "Long Haul (200-500 mi)", states: [], baseRate: 2.20, fuelSurcharge: 0.22, minCharge: 800 },
  { id: "cross", name: "Cross Country (500+ mi)", states: [], baseRate: 1.85, fuelSurcharge: 0.25, minCharge: 1500 },
];

export const TRUCK_TYPES: TruckType[] = [
  { id: "pickup", name: "Pickup Truck", maxWeight: 2000, maxVolume: 2, costPerMile: 1.20, flatFee: 75, icon: "🛻" },
  { id: "single", name: "Single Axle Dump", maxWeight: 13000, maxVolume: 10, costPerMile: 2.50, flatFee: 150, icon: "🚛" },
  { id: "tandem", name: "Tandem Axle Dump", maxWeight: 26000, maxVolume: 18, costPerMile: 3.80, flatFee: 225, icon: "🚚" },
  { id: "semi", name: "Semi Trailer", maxWeight: 44000, maxVolume: 25, costPerMile: 4.50, flatFee: 350, icon: "🚛" },
  { id: "super", name: "Super Dump", maxWeight: 40000, maxVolume: 22, costPerMile: 5.20, flatFee: 400, icon: "🚜" },
];

export const MATERIAL_TYPES: MaterialType[] = [
  { id: "gravel", name: "Gravel", weightPerUnit: 2800, category: "Aggregate" },
  { id: "sand", name: "Sand", weightPerUnit: 2700, category: "Aggregate" },
  { id: "topsoil", name: "Topsoil", weightPerUnit: 2200, category: "Soil" },
  { id: "fill-dirt", name: "Fill Dirt", weightPerUnit: 2000, category: "Soil" },
  { id: "crushed-stone", name: "Crushed Stone", weightPerUnit: 2700, category: "Aggregate" },
  { id: "mulch", name: "Mulch", weightPerUnit: 800, category: "Organic" },
  { id: "compost", name: "Compost", weightPerUnit: 1400, category: "Organic" },
  { id: "concrete", name: "Concrete Mix", weightPerUnit: 3600, category: "Construction" },
  { id: "asphalt", name: "Asphalt", weightPerUnit: 3200, category: "Construction" },
  { id: "riprap", name: "Riprap", weightPerUnit: 2600, category: "Aggregate" },
];

export function getZoneByDistance(miles: number): ShippingZone {
  if (miles <= 50) return SHIPPING_ZONES[0];
  if (miles <= 200) return SHIPPING_ZONES[1];
  if (miles <= 500) return SHIPPING_ZONES[2];
  return SHIPPING_ZONES[3];
}

export function calculateShippingCost(
  distanceMiles: number,
  weightLbs: number,
  truckType: TruckType
): { baseCost: number; fuelSurcharge: number; total: number } {
  const zone = getZoneByDistance(distanceMiles);
  const baseCost = Math.max(
    distanceMiles * truckType.costPerMile + truckType.flatFee,
    zone.minCharge
  );
  const fuelSurcharge = baseCost * zone.fuelSurcharge;
  return {
    baseCost: Math.round(baseCost * 100) / 100,
    fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
    total: Math.round((baseCost + fuelSurcharge) * 100) / 100,
  };
}

export interface TruckAllocation {
  truckType: TruckType;
  loads: number;
  volumePerLoad: number;
  weightPerLoad: number;
  costPerLoad: number;
  totalCost: number;
}

export function calculateMultiTruckSplit(
  totalVolumeCY: number,
  material: MaterialType,
  distanceMiles: number,
  preferredTruckId?: string
): TruckAllocation[] {
  const totalWeightLbs = totalVolumeCY * material.weightPerUnit;
  const allocations: TruckAllocation[] = [];

  // Sort trucks by capacity (largest first) or use preferred
  const sortedTrucks = preferredTruckId
    ? TRUCK_TYPES.filter((t) => t.id === preferredTruckId)
    : [...TRUCK_TYPES].sort((a, b) => b.maxVolume - a.maxVolume);

  let remainingVolume = totalVolumeCY;
  let remainingWeight = totalWeightLbs;

  for (const truck of sortedTrucks) {
    if (remainingVolume <= 0) break;

    const volumePerLoad = Math.min(
      truck.maxVolume,
      truck.maxWeight / material.weightPerUnit
    );
    const weightPerLoad = volumePerLoad * material.weightPerUnit;
    const loads = Math.ceil(remainingVolume / volumePerLoad);
    const { total: costPerLoad } = calculateShippingCost(distanceMiles, weightPerLoad, truck);

    allocations.push({
      truckType: truck,
      loads,
      volumePerLoad: Math.round(volumePerLoad * 100) / 100,
      weightPerLoad: Math.round(weightPerLoad),
      costPerLoad,
      totalCost: Math.round(costPerLoad * loads * 100) / 100,
    });

    remainingVolume -= loads * volumePerLoad;
    remainingWeight -= loads * weightPerLoad;
  }

  return allocations;
}
