import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Truck, DollarSign, Loader2, AlertCircle, Package, Route } from "lucide-react";
import { TRUCK_TYPES } from "@/lib/shipping-data";
import {
  fetchShopifyProducts,
  getShippingQuote,
  type ShopifyProduct,
  type ShippingQuoteResponse,
} from "@/lib/shopify-api";

const ShopifyShippingQuote = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [distance, setDistance] = useState("");
  const [truckType, setTruckType] = useState("single");

  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<ShippingQuoteResponse | null>(null);

  useEffect(() => {
    fetchShopifyProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);
  const variants = selectedProduct?.variants || [];

  // Auto-select first variant when product changes
  useEffect(() => {
    if (variants.length > 0 && !variants.find((v) => String(v.id) === selectedVariantId)) {
      setSelectedVariantId(String(variants[0].id));
    }
  }, [selectedProductId]);

  const handleGetQuote = async () => {
    if (!selectedVariantId || !distance) return;
    setQuoting(true);
    setQuote(null);
    try {
      const result = await getShippingQuote({
        product_id: Number(selectedProductId),
        variant_id: Number(selectedVariantId),
        quantity: Number(quantity),
        distance_miles: Number(distance),
        truck_type: truckType,
      });
      setQuote(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setQuoting(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <ShoppingBag className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <CardTitle className="font-heading text-xl">Shopify Shipping Quote</CardTitle>
            <CardDescription>Select a product from your store and get a shipping estimate</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading products from Shopify…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No products found in your Shopify store.</p>
        )}

        {products.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-3.5 w-3.5 text-primary" /> Product
                </Label>
                <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); setQuote(null); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {variants.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Variant</Label>
                  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.title} — ${v.price} ({v.weight} {v.weight_unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
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
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" /> Truck Type
                </Label>
                <Select value={truckType} onValueChange={setTruckType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUCK_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.icon} {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGetQuote}
              disabled={!selectedVariantId || !distance || quoting}
              className="w-full font-heading text-base font-semibold tracking-wide"
              size="lg"
            >
              {quoting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <DollarSign className="mr-2 h-5 w-5" />
              )}
              {quoting ? "Getting Quote…" : "Get Shipping Quote"}
            </Button>

            {quote && (
              <div className="rounded-xl border-2 border-accent/20 bg-surface p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Shipping Zone</span>
                  <span className="font-mono text-sm font-semibold">{quote.zone}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Truck</span>
                  <span className="font-mono text-sm">{quote.truck.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Total Weight</span>
                  <span className="font-mono text-sm">{quote.weight_lbs.toLocaleString()} lbs</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Base Cost</span>
                  <span className="font-mono text-sm">${quote.baseCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Fuel Surcharge</span>
                  <span className="font-mono text-sm text-warning">${quote.fuelSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-lg font-heading font-bold">Total Cost</span>
                  <span className="font-mono text-2xl font-bold text-accent">${quote.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ShopifyShippingQuote;
