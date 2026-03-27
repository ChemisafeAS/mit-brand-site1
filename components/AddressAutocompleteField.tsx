"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./address-autocomplete-field.module.css";

type Suggestion = {
  tekst: string;
};

type AddressAutocompleteFieldProps = {
  className?: string;
  defaultValue?: string;
  name: string;
  placeholder?: string;
};

export default function AddressAutocompleteField({
  className,
  defaultValue = "",
  name,
  placeholder,
}: AddressAutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [value, setValue] = useState(defaultValue);
  const requestIdRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      const trimmed = value.trim();

      if (trimmed.length < 3) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      const currentRequestId = requestIdRef.current + 1;

      requestIdRef.current = currentRequestId;
      setIsLoading(true);

      try {
        const response = await fetch(
          `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(
            trimmed
          )}&per_side=5`
        );

        if (!response.ok) {
          throw new Error("Autocomplete request failed");
        }

        const data = (await response.json()) as Suggestion[];

        if (requestIdRef.current === currentRequestId) {
          setSuggestions(data);
        }
      } catch {
        if (requestIdRef.current === currentRequestId) {
          setSuggestions([]);
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        autoComplete="off"
        className={className}
        name={name}
        onChange={(event) => {
          setValue(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        type="text"
        value={value}
      />

      {isOpen && (isLoading || suggestions.length > 0) && (
        <div className={styles.dropdown} id={listId}>
          {isLoading ? (
            <div className={styles.status}>Søger efter adresser...</div>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.tekst}
                className={styles.option}
                onClick={() => {
                  setValue(suggestion.tekst);
                  setSuggestions([]);
                  setIsOpen(false);
                }}
                type="button"
              >
                {suggestion.tekst}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
