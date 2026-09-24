import { useEffect, useState } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
  /** flatpickr format string for the displayed value — defaults to "Y-m-d" (existing behavior) */
  dateFormat?: string;
  /**
   * Optional visual-only override for what the input shows (e.g. short Buddhist-era text).
   * Doesn't touch `dateFormat` / the value passed to onChange — those stay whatever the
   * caller needs for querying. ponytail: opt-in prop so existing callers are untouched.
   */
  displayFormat?: (date: Date) => string;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  placeholder,
  dateFormat = "Y-m-d",
  displayFormat,
}: PropsType) {
  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    const updateDisplay: Hook = (dates) => {
      if (displayFormat && dates[0]) setDisplayText(displayFormat(dates[0]));
    };

    const changeHooks: Hook[] = displayFormat ? [updateDisplay] : [];
    if (onChange) changeHooks.push(...(Array.isArray(onChange) ? onChange : [onChange]));

    const flatPickr = flatpickr(`#${id}`, {
      mode: mode || "single",
      monthSelectorType: "static",
      dateFormat,
      defaultDate,
      onChange: changeHooks,
      onReady: updateDisplay,
    });

    return () => {
      if (!Array.isArray(flatPickr)) {
        flatPickr.destroy();
      }
    };
  }, [mode, onChange, id, defaultDate, dateFormat, displayFormat]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          readOnly
          placeholder={placeholder}
          className={`h-11 w-full cursor-pointer rounded-lg border appearance-none pl-4 pr-11 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:placeholder:text-white/30  bg-transparent border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800 ${
            displayFormat ? "text-transparent caret-transparent" : "text-gray-800 dark:text-white/90"
          }`}
        />

        {displayFormat && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-gray-800 dark:text-white/90">
            {displayText}
          </span>
        )}

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
