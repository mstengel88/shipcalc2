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

interface AddressPrediction {
  id: string;
  description: string;
  mainText: string;
  secondaryText?: string;
}

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
  const serviceRef = useRef<null | { getPredictions: (query: string) => Promise<AddressPrediction[]> }>(null);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsScript()
      .then((places) => {
        if (cancelled || serviceRef.current) return;

        if (places.AutocompleteService) {
          const autocompleteService = new places.AutocompleteService();
          serviceRef.current = {
            getPredictions(query: string) {
              return new Promise((resolve) => {
                autocompleteService.getPlacePredictions(
                  {
                    input: query,
                    types: ["address"],
                    componentRestrictions: { country: "us" },
                  },
                  (results: any[] | null, status: string) => {
                    if (status !== places.PlacesServiceStatus.OK || !results?.length) {
                      resolve([]);
                      return;
                    }

                    resolve(
                      results.map((prediction) => ({
                        id: prediction.place_id,
                        description: prediction.description,
                        mainText: prediction.structured_formatting?.main_text || prediction.description,
                        secondaryText: prediction.structured_formatting?.secondary_text,
                      })),
                    );
                  },
                );
              });
            },
          };
        } else if (places.AutocompleteSuggestion) {
          serviceRef.current = {
            async getPredictions(query: string) {
              const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: query,
                includedRegionCodes: ["us"],
                region: "us",
              });

              return suggestions
                .map((suggestion: any) => suggestion.placePrediction)
                .filter(Boolean)
                .map((prediction: any) => ({
                  id: prediction.placeId,
                  description: prediction.text?.text || "",
                  mainText: prediction.mainText?.text || prediction.text?.text || "",
                  secondaryText: prediction.secondaryText?.text,
                }))
                .filter((prediction: AddressPrediction) => prediction.description);
            },
          };
        } else {
          throw new Error("Google Places autocomplete is unavailable");
        }

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
      serviceRef.current
        ?.getPredictions(query)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;

          if (!results.length) {
            setPredictions([]);
            setOpen(false);
            setHighlightedIndex(-1);
            return;
          }

          setPredictions(results);
          setOpen(true);
          setHighlightedIndex(0);
        })
        .catch((error) => {
          console.error(error);
          if (requestId !== requestIdRef.current) return;
          setPredictions([]);
          setOpen(false);
          setHighlightedIndex(-1);
        });
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

  const selectPrediction = (prediction: AddressPrediction) => {
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
              key={prediction.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPrediction(prediction)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                index === highlightedIndex ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <span className="block truncate font-medium">{prediction.mainText || prediction.description}</span>
              {prediction.secondaryText && (
                <span className="block truncate text-xs text-muted-foreground">
                  {prediction.secondaryText}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
