export const SHIPPING_ZONES = [
  { id: "local", name: "Local (0-50 mi)", fuelSurcharge: 0.15, minCharge: 150 },
  { id: "regional", name: "Regional (50-200 mi)", fuelSurcharge: 0.18, minCharge: 350 },
  { id: "long", name: "Long Haul (200-500 mi)", fuelSurcharge: 0.22, minCharge: 800 },
  { id: "cross", name: "Cross Country (500+ mi)", fuelSurcharge: 0.25, minCharge: 1500 },
];

export const TRUCK_TYPES = [
  { id: "pickup", name: "Pickup Truck", costPerMile: 1.2, flatFee: 75 },
  { id: "single", name: "Single Axle Dump", costPerMile: 2.5, flatFee: 150 },
  { id: "tandem", name: "Tandem Axle Dump", costPerMile: 3.8, flatFee: 225 },
  { id: "semi", name: "Semi Trailer", costPerMile: 4.5, flatFee: 350 },
  { id: "super", name: "Super Dump", costPerMile: 5.2, flatFee: 400 },
];

export function getZoneByDistance(miles) {
  if (miles <= 50) return SHIPPING_ZONES[0];
  if (miles <= 200) return SHIPPING_ZONES[1];
  if (miles <= 500) return SHIPPING_ZONES[2];
  return SHIPPING_ZONES[3];
}

export function calculateShippingCost(distanceMiles, truckType) {
  const zone = getZoneByDistance(distanceMiles);
  const baseCost = Math.max(distanceMiles * truckType.costPerMile + truckType.flatFee, zone.minCharge);
  const fuelSurcharge = baseCost * zone.fuelSurcharge;
  return {
    baseCost: Math.round(baseCost * 100) / 100,
    fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
    total: Math.round((baseCost + fuelSurcharge) * 100) / 100,
  };
}
