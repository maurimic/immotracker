"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn, parseDateToISO } from "@/lib/utils";

export { parseDateToISO };

/**
 * Wandelt ein ISO- oder beliebiges Datum in das europäische Anzeigeformat DD.MM.YYYY um.
 */
export function formatISOToGerman(val?: string | Date | null): string {
  if (!val) return "";
  const iso = parseDateToISO(val);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Hilfsfunktion zur Formatierung während der Eingabe.
 */
function maskGermanDateTyping(rawInput: string, isBackspace: boolean): string {
  if (isBackspace) return rawInput;

  const clean = rawInput.replace(/[^\d.]/g, "");
  const parts = clean.split(".");

  // Falls der Nutzer Zahlen ohne Punkte eingegeben / eingefügt hat (z.B. 15082024)
  if (parts.length === 1 && clean.length > 2) {
    const digits = clean.slice(0, 8);
    let formatted = digits.slice(0, 2);
    if (digits.length >= 2) formatted += ".";
    if (digits.length > 2) formatted += digits.slice(2, 4);
    if (digits.length >= 4) formatted += ".";
    if (digits.length > 4) formatted += digits.slice(4);
    return formatted;
  }

  const d = parts[0] ? parts[0].slice(0, 2) : "";
  const m = parts[1] !== undefined ? parts[1].slice(0, 2) : undefined;
  const y = parts[2] !== undefined ? parts[2].slice(0, 4) : undefined;

  let res = d;
  if (d.length === 2 && parts.length === 1 && !rawInput.endsWith(".")) {
    res += ".";
  } else if (parts.length > 1) {
    res += "." + (m || "");
    if (m && m.length === 2 && parts.length === 2 && !rawInput.endsWith(".")) {
      res += ".";
    } else if (parts.length > 2) {
      res += "." + (y || "");
    }
  }

  return res.slice(0, 10);
}

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string | null;
  onChange?: (e: { target: { value: string; name?: string } } | any) => void;
  className?: string;
  placeholder?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      className,
      placeholder = "TT.MM.JJJJ",
      required,
      disabled,
      name,
      id,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => formatISOToGerman(value));
    const [isFocused, setIsFocused] = React.useState(false);
    const hiddenPickerRef = React.useRef<HTMLInputElement>(null);
    const isBackspaceRef = React.useRef(false);
    const internalInputRef = React.useRef<HTMLInputElement | null>(null);

    // Synchronisiere Anzeige bei Prop-Änderungen von außen
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatISOToGerman(value));
      }
    }, [value, isFocused]);

    const notifyParent = React.useCallback(
      (newIso: string) => {
        if (!onChange) return;
        onChange({
          target: {
            value: newIso,
            name,
          },
        } as any);
      },
      [onChange, name]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      isBackspaceRef.current = e.key === "Backspace" || e.key === "Delete";
      props.onKeyDown?.(e);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!raw) {
        setDisplayValue("");
        notifyParent("");
        if (internalInputRef.current) {
          internalInputRef.current.setCustomValidity("");
        }
        return;
      }

      const masked = maskGermanDateTyping(raw, isBackspaceRef.current);
      setDisplayValue(masked);

      // Falls ein vollständiges Datum erreicht wurde, sofort im Parent aktualisieren
      if (masked.length === 10) {
        const iso = parseDateToISO(masked);
        if (iso) {
          notifyParent(iso);
          if (internalInputRef.current) {
            internalInputRef.current.setCustomValidity("");
          }
        }
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      const trimmed = displayValue.trim();

      if (!trimmed) {
        setDisplayValue("");
        notifyParent("");
        if (internalInputRef.current) {
          internalInputRef.current.setCustomValidity("");
        }
      } else {
        const iso = parseDateToISO(trimmed);
        if (iso) {
          const de = formatISOToGerman(iso);
          setDisplayValue(de);
          notifyParent(iso);
          if (internalInputRef.current) {
            internalInputRef.current.setCustomValidity("");
          }
        } else {
          // Ungültige Eingabe: Wenn ein gültiger Wert im Parent lag, zurücksetzen, sonst leeren
          if (value) {
            setDisplayValue(formatISOToGerman(value));
          } else {
            setDisplayValue("");
            notifyParent("");
          }
        }
      }

      onBlur?.(e);
    };

    // Kalender-Klick: Öffnet den nativen Browser-Picker
    const handleCalendarClick = () => {
      if (disabled) return;
      if (hiddenPickerRef.current) {
        if (typeof hiddenPickerRef.current.showPicker === "function") {
          try {
            hiddenPickerRef.current.showPicker();
            return;
          } catch {
            // Fallback falls showPicker fehlschlägt
          }
        }
        hiddenPickerRef.current.focus();
        hiddenPickerRef.current.click();
      }
    };

    const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedIso = e.target.value;
      if (selectedIso) {
        const de = formatISOToGerman(selectedIso);
        setDisplayValue(de);
        notifyParent(selectedIso);
        if (internalInputRef.current) {
          internalInputRef.current.setCustomValidity("");
        }
      }
    };

    const currentIso = parseDateToISO(value) || "";

    return (
      <div className="relative flex items-center w-full">
        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          name={name}
          id={id}
          ref={(node) => {
            internalInputRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-8 font-mono",
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Kalender öffnen"
          onClick={handleCalendarClick}
          disabled={disabled}
          className="absolute right-1 text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors disabled:opacity-40"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
        </button>
        {/* Unsichtbarer Date-Picker für native Kalenderauswahl */}
        <input
          type="date"
          ref={hiddenPickerRef}
          tabIndex={-1}
          aria-hidden="true"
          value={currentIso}
          onChange={handleNativePickerChange}
          className="sr-only pointer-events-none absolute w-0 h-0 opacity-0"
        />
      </div>
    );
  }
);

DateInput.displayName = "DateInput";
