import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock,
  Loader2,
  ShoppingBag,
  MapPin,
  DollarSign,
  Package,
  Truck,
  Printer,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { verifyAdminPassword } from "@/lib/admin-api";
import {
  fetchShopifyProducts,
  getDriveTimeQuote,
  type ShopifyProduct,
  type DriveTimeQuoteResponse,
} from "@/lib/shopify-api";
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput";

const Quote = () => {
  // Auth state
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Product state
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Address state
  const [destination, setDestination] = useState("");
  const selectedAddressRef = useRef("");

  // Quote state
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<DriveTimeQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);
  const variants = selectedProduct?.variants || [];
  const selectedVariant = variants.find((v) => String(v.id) === selectedVariantId);

  const handleLogin = async () => {
    setChecking(true);
    setAuthError(false);
    const valid = await verifyAdminPassword(password);
    if (valid) {
      setAuthenticated(true);
    } else {
      setAuthError(true);
    }
    setChecking(false);
  };

  // Load products after auth
  useEffect(() => {
    if (!authenticated) return;
    setLoadingProducts(true);
    fetchShopifyProducts()
      .then(setProducts)
      .catch((e) => setProductError(e.message))
      .finally(() => setLoadingProducts(false));
  }, [authenticated]);

  // Auto-select first variant
  useEffect(() => {
    if (variants.length > 0 && !variants.find((v) => String(v.id) === selectedVariantId)) {
      setSelectedVariantId(String(variants[0].id));
    }
  }, [selectedProductId]);

  const handleGetQuote = async () => {
    const addr = selectedAddressRef.current || destination.trim();
    if (!addr || !selectedVariantId) return;
    setQuoting(true);
    setQuote(null);
    setQuoteError(null);
    try {
      const result = await getDriveTimeQuote({ destination: addr, variant_id: Number(selectedVariantId) });
      setQuote(result);
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setQuoting(false);
    }
  };

  const unitPrice = selectedVariant ? parseFloat(selectedVariant.price) : 0;
  const qty = Math.max(1, parseInt(quantity) || 1);
  const subtotal = unitPrice * qty;
  const deliveryCost = quote && !quote.beyond_mileage_limit ? quote.total_cost : 0;
  const grandTotal = subtotal + deliveryCost;

  const handlePrint = () => {
    window.print();
  };

  if (!authenticated) {
    return (
      <div className="dark quote-page min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'hsl(0 0% 0%)', color: 'hsl(0 0% 100%)' }}>
        <Card className="w-full max-w-sm border-2">
          <CardHeader className="text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="font-heading">Quote Builder — Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
              />
              {authError && <p className="text-sm text-destructive">Invalid password</p>}
            </div>
            <Button onClick={handleLogin} disabled={!password || checking} className="w-full">
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen p-4 print:p-0 print:bg-white quote-page" style={{ backgroundColor: 'hsl(0 0% 0%)', color: 'hsl(0 0% 100%)' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Quote Builder
          </h1>
          {quote && !quote.beyond_mileage_limit && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Print Quote
            </Button>
          )}
        </div>

        {loadingProducts && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading products from Shopify…</span>
          </div>
        )}

        {productError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{productError}</span>
          </div>
        )}

        {!loadingProducts && products.length > 0 && (
          <>
            {/* Product Selection */}
            <Card className="border-2 print:border print:shadow-none">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg font-heading">
                  <ShoppingBag className="h-5 w-5 text-primary" /> Select Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
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
                          <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
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
                              {v.title} — ${v.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => { setQuantity(e.target.value); setQuote(null); }}
                    />
                  </div>
                  {selectedVariant && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Unit Price</Label>
                      <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 font-mono text-sm">
                        ${unitPrice.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Address */}
            <Card className="border-2 print:border print:shadow-none">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg font-heading">
                  <Truck className="h-5 w-5 text-primary" /> Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Customer Delivery Address
                  </Label>
                  <AddressAutocompleteInput
                    value={destination}
                    placeholder="Start typing an address..."
                    onValueChange={(value) => {
                      setDestination(value);
                      selectedAddressRef.current = "";
                    }}
                    onAddressSelect={(address) => {
                      selectedAddressRef.current = address;
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                  />
                </div>
                <Button
                  onClick={handleGetQuote}
                  disabled={!selectedVariantId || !destination.trim() || quoting}
                  className="w-full font-heading text-base font-semibold tracking-wide"
                  size="lg"
                >
                  {quoting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating…</>
                  ) : (
                    <><DollarSign className="mr-2 h-5 w-5" /> Calculate Quote</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {quoteError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{quoteError}</span>
              </div>
            )}

            {/* Quote Summary */}
            {quote && !quote.beyond_mileage_limit && selectedProduct && selectedVariant && (
              <Card className="border-2 border-primary/20 print:border print:shadow-none">
                <CardHeader className="border-b border-primary/10 bg-primary/5 print:bg-white">
                  <CardTitle className="flex items-center gap-2 text-lg font-heading">
                    <FileText className="h-5 w-5 text-primary" /> Quote Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Product line */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Product</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedProduct.title}</p>
                        {variants.length > 1 && (
                          <p className="text-sm text-muted-foreground">{selectedVariant.title}</p>
                        )}
                      </div>
                      <span className="font-mono text-sm">${unitPrice.toFixed(2)} × {qty}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground">Product Subtotal</span>
                      <span className="font-mono font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Delivery line */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Delivery</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Origin</span>
                      <span className="font-mono text-right max-w-[60%]">{quote.origin}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-mono text-right max-w-[60%]">{quote.destination}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Distance</span>
                      <span className="font-mono">{quote.one_way_distance_miles} miles</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Drive Time (one way)</span>
                      <span className="font-mono">{quote.one_way_duration_text}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Round Trip</span>
                      <span className="font-mono">{quote.round_trip_minutes} min</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-mono">${quote.rate_per_minute}/min</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground">Delivery Cost</span>
                      <span className="font-mono font-semibold">${deliveryCost.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Grand total */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xl font-heading font-bold">Grand Total</span>
                    <span className="font-mono text-3xl font-bold text-primary">${grandTotal.toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2 print:pt-6">
                    Quote generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            )}

            {quote && quote.beyond_mileage_limit && (
              <Card className="border-2 border-yellow-500/30">
                <CardContent className="pt-6 text-center space-y-3">
                  <AlertCircle className="h-8 w-8 mx-auto text-yellow-500" />
                  <p className="text-lg font-bold">Outside Delivery Area</p>
                  <p className="text-sm text-muted-foreground">
                    Destination is {quote.one_way_distance_miles} miles away — exceeds the {quote.max_miles}-mile limit.
                    A custom quote is needed for this delivery.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Quote;
