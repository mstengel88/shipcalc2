import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORIGIN_ADDRESS = "W185 N7487, Narrow Ln, Menomonee Falls, WI 53051";
const RATE_PER_MINUTE = 2.08;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ rates: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const rateRequest = body.rate;

    if (!rateRequest) {
      console.error("No rate object in request body");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dest = rateRequest.destination;
    if (!dest) {
      console.error("No destination in rate request");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build destination address string
    const destParts = [
      dest.address1,
      dest.address2,
      dest.city,
      dest.province,
      dest.postal_code,
      dest.country,
    ].filter(Boolean);
    const destinationAddress = destParts.join(", ");

    console.log("Carrier service request for destination:", destinationAddress);

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Maps Distance Matrix API
    const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    mapsUrl.searchParams.set("origins", ORIGIN_ADDRESS);
    mapsUrl.searchParams.set("destinations", destinationAddress);
    mapsUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    mapsUrl.searchParams.set("units", "imperial");

    const mapsRes = await fetch(mapsUrl.toString());
    const mapsData = await mapsRes.json();

    if (mapsData.status !== "OK") {
      console.error("Google Maps error:", mapsData.status, mapsData.error_message);
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const element = mapsData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.error("No route found:", element?.status);
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oneWaySeconds = element.duration.value;
    const roundTripMinutes = (oneWaySeconds * 2) / 60;
    const totalCostDollars = roundTripMinutes * RATE_PER_MINUTE;
    const totalPriceCents = Math.round(totalCostDollars * 100);

    const oneWayMiles = Math.round(element.distance.value / 1609.34 * 10) / 10;

    console.log(`Route: ${oneWayMiles} mi one-way, ${Math.round(roundTripMinutes)} min round-trip, $${totalCostDollars.toFixed(2)}`);

    const rates = [
      {
        service_name: "GHS Delivery",
        service_code: "ghs_delivery",
        total_price: String(totalPriceCents),
        description: `Delivery from Menomonee Falls, WI (${oneWayMiles} mi, ~${element.duration.text} one-way)`,
        currency: rateRequest.currency || "USD",
        min_delivery_date: null,
        max_delivery_date: null,
      },
    ];

    return new Response(JSON.stringify({ rates }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Carrier service error:", error);
    return new Response(JSON.stringify({ rates: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
