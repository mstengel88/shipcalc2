import test from "node:test";
import assert from "node:assert/strict";
import { calculateShippingCost, getZoneByDistance, TRUCK_TYPES } from "./shipping-calc.mjs";

test("assigns expected distance zones", () => {
  assert.equal(getZoneByDistance(50).id, "local");
  assert.equal(getZoneByDistance(51).id, "regional");
  assert.equal(getZoneByDistance(501).id, "cross");
});

test("applies truck mileage, flat fee, and zone surcharge", () => {
  const tandem = TRUCK_TYPES.find(({ id }) => id === "tandem");
  assert.deepEqual(calculateShippingCost(40, tandem), {
    baseCost: 377,
    fuelSurcharge: 56.55,
    total: 433.55,
  });
});
