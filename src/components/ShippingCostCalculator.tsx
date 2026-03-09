import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, DollarSign, Loader2, Clock, Phone } from "lucide-react";
import { getDriveTimeQuote, type DriveTimeQuoteResponse } from "@/lib/shopify-api";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    google: any;
  }
}

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

const ShippingCostCalculator = () => {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DriveTimeQuoteResponse | null>(null);
  const [originLabel, setOriginLabel] = useState("Menomonee Falls, WI 53051");
  const [phoneNumber, setPhoneNumber] = useState("(262) 345-4001");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const selectedAddressRef = useRef<string>("");
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    // Load origin label and phone number
    const loadInfo = async () => {
      const [originRes, settingsRes] = await Promise.all([
        supabase.from("origin_addresses").select("label, address").eq("is_active", true).limit(1).single(),
        supabase.from("app_settings").select("key, value").in("key", ["phone_number"]),
      ]);
      if (originRes.data) setOriginLabel(`${originRes.data.label} — ${originRes.data.address}`);
      const phone = settingsRes.data?.find((s) => s.key === "phone_number");
      if (phone) setPhoneNumber(phone.value);
    };
    loadInfo();
  }, []);

  const doCalculate = useCallback(async (addr: string) => {
    if (!addr) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      const result = await getDriveTimeQuote({ destination: addr });
      setQuote(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsScript().then(() => {
      if (cancelled || !inputRef.current || autocompleteRef.current) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.formatted_address) {
          selectedAddressRef.current = place.formatted_address;
          setDestination(place.formatted_address);
          // If user pressed Enter while dropdown was open, submit now
          if (pendingSubmitRef.current) {
            pendingSubmitRef.current = false;
            doCalculate(place.formatted_address);
          }
        }
      });
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [doCalculate]);

  const handleCalculate = async () => {
    const addr = selectedAddressRef.current || destination.trim();
    if (!addr) return;
    doCalculate(addr);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // If we already have a selected address, submit immediately
      if (selectedAddressRef.current) {
        doCalculate(selectedAddressRef.current);
      } else {
        // Mark pending — place_changed will fire after autocomplete selects, then we submit
        pendingSubmitRef.current = true;
        // Fallback: if no place_changed fires within 500ms, try with raw text
        setTimeout(() => {
          if (pendingSubmitRef.current) {
            pendingSubmitRef.current = false;
            const addr = selectedAddressRef.current || destination.trim();
            if (addr) doCalculate(addr);
          }
        }, 500);
      }
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
          </Label>
          <input
            ref={inputRef}
            placeholder="Start typing an address..."
            defaultValue={destination}
            onChange={(e) => { setDestination(e.target.value); selectedAddressRef.current = ""; }}
            onKeyDown={handleKeyDown}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Origin: {originLabel}
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

        {quote && quote.beyond_mileage_limit && (
          <div className="rounded-xl border-2 border-accent/30 bg-accent/10 p-6 space-y-3 text-center">
            <Phone className="h-8 w-8 text-accent mx-auto" />
            <p className="text-lg font-heading font-bold">Outside Delivery Area</p>
            <p className="text-sm text-muted-foreground">
              Your destination is {quote.one_way_distance_miles} miles away, which exceeds our {quote.max_miles}-mile delivery radius.
            </p>
            <p className="text-sm font-semibold">
              Please call us for a custom shipping quote:
            </p>
            <a href="tel:+12623454001" className="inline-block text-xl font-mono font-bold text-primary hover:underline">
              (262) 345-4001
            </a>
          </div>
        )}

        {quote && !quote.beyond_mileage_limit && (
          <div className="rounded-xl border-2 border-primary/20 bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Destination</span>
              <span className="font-mono text-sm font-semibold text-right max-w-[60%]">{quote.destination}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium text-muted-foreground">Distance</span>
              <span className="font-mono text-sm">{quote.one_way_distance_miles} miles</span>
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
