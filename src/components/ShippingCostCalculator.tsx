import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, DollarSign, Loader2, Clock } from "lucide-react";
import { getDriveTimeQuote, type DriveTimeQuoteResponse } from "@/lib/shopify-api";

declare global {
  interface Window {
    google: any;
  }
}

const ShippingCostCalculator = () => {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DriveTimeQuoteResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.formatted_address) {
          setDestination(place.formatted_address);
        }
      });
    };

    // Wait for Google Maps to load
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) {
          initAutocomplete();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleCalculate = async () => {
    if (!destination.trim()) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      const result = await getDriveTimeQuote({ destination: destination.trim() });
      setQuote(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Clock className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="font-heading text-xl">Delivery Cost Calculator</CardTitle>
            <CardDescription>Round-trip time-based pricing at $2.08/min from our location</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
          </Label>
          <Input
            ref={inputRef}
            placeholder="Start typing an address..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
          />
          <p className="text-xs text-muted-foreground">
            Origin: Menomonee Falls, WI 53051
          </p>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!destination.trim() || loading}
          className="w-full font-heading text-base font-semibold tracking-wide"
          size="lg"
        >
          {loading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <DollarSign className="mr-2 h-5 w-5" />
          )}
          {loading ? "Calculating Route…" : "Get Delivery Quote"}
        </Button>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {quote && (
          <div className="rounded-xl border-2 border-primary/20 bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Destination</span>
              <span className="font-mono text-sm font-semibold text-right max-w-[60%]">{quote.destination}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-lg font-heading font-bold">Total Cost</span>
              <span className="font-mono text-2xl font-bold text-primary">${quote.total_cost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShippingCostCalculator;
