import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { loadGoogleMapsScript } from "@/lib/google-maps";

interface AddressAutocompleteInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onAddressSelect: (address: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const MIN_QUERY_LENGTH = 3;

export function AddressAutocompleteInput({
  value,
  onValueChange,
  onAddressSelect,
  placeholder,
  className,
  style,
  onKeyDown,
}: AddressAutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const serviceRef = useRef<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || serviceRef.current) return;
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        setPlacesReady(true);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    const requestId = ++requestIdRef.current;

    if (query.length < MIN_QUERY_LENGTH || !placesReady || !serviceRef.current) {
      setPredictions([]);
      setOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    const timeout = window.setTimeout(() => {
      serviceRef.current.getPlacePredictions(
        {
          input: query,
          types: ["address"],
          componentRestrictions: { country: "us" },
        },
        (results: any[] | null, status: string) => {
          if (requestId !== requestIdRef.current) return;

          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
            setPredictions([]);
            setOpen(false);
            setHighlightedIndex(-1);
            return;
          }

          setPredictions(results);
          setOpen(true);
          setHighlightedIndex(0);
        },
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [placesReady, value]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectPrediction = (prediction: any) => {
    const address = prediction.description;
    onValueChange(address);
    onAddressSelect(address);
    setPredictions([]);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && predictions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((index) => (index + 1) % predictions.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((index) => (index <= 0 ? predictions.length - 1 : index - 1));
        return;
      }

      if (event.key === "Enter" && highlightedIndex >= 0) {
        event.preventDefault();
        selectPrediction(predictions[highlightedIndex]);
        return;
      }

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
    }

    onKeyDown?.(event);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        style={style}
        autoComplete="off"
      />
      {open && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPrediction(prediction)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                index === highlightedIndex ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <span className="block truncate font-medium">{prediction.structured_formatting?.main_text || prediction.description}</span>
              {prediction.structured_formatting?.secondary_text && (
                <span className="block truncate text-xs text-muted-foreground">
                  {prediction.structured_formatting.secondary_text}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
