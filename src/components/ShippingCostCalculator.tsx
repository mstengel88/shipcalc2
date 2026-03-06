import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, DollarSign, Loader2, Clock, Route, ArrowLeftRight } from "lucide-react";
import { getDriveTimeQuote, type DriveTimeQuoteResponse } from "@/lib/shopify-api";

const ShippingCostCalculator = () => {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DriveTimeQuoteResponse | null>(null);

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
            placeholder="e.g. 456 Oak Ave, Milwaukee, WI 53202"
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
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Route className="h-3.5 w-3.5" /> One-Way Distance
              </span>
              <span className="font-mono text-sm">{quote.one_way_distance_miles} mi</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> One-Way Drive Time
              </span>
              <span className="font-mono text-sm">{quote.one_way_duration_text}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Round-Trip Time
              </span>
              <span className="font-mono text-sm font-semibold">{quote.round_trip_minutes} min</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Rate</span>
              <span className="font-mono text-sm">${quote.rate_per_minute.toFixed(2)}/min</span>
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
