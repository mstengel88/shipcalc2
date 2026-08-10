declare global {
  interface Window {
    google: any;
  }
}

let googleMapsScriptPromise: Promise<void> | null = null;
let googlePlacesPromise: Promise<any> | null = null;

function loadGoogleMapsBaseScript(): Promise<void> {
  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script");

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")), { once: true });
      return;
    }

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export function loadGoogleMapsScript(): Promise<any> {
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps.places);
  }

  if (googlePlacesPromise) {
    return googlePlacesPromise;
  }

  googlePlacesPromise = loadGoogleMapsBaseScript()
    .then(async () => {
      if (window.google?.maps?.importLibrary) {
        return window.google.maps.importLibrary("places");
      }

      if (window.google?.maps?.places) {
        return window.google.maps.places;
      }

      if (!window.google?.maps?.places) {
        throw new Error("Google Places library did not load");
      }
    })
    .catch((error) => {
      googlePlacesPromise = null;
      throw error;
    });

  return googlePlacesPromise;
}
