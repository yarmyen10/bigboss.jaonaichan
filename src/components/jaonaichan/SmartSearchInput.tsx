import { useState, useEffect, useRef } from "react";
import { SearchOneIcon, CheckCircleIcon, BoxIcon } from "../../icons";

type SearchType = "general" | "batch" | "lot" | "status";

interface SmartSearchInputProps {
  searchType: SearchType;
  setSearchType: (type: SearchType) => void;
  searchValue: string;
  setSearchValue: (val: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
  statusOptions: { value: string; label: string }[];
  rtsFilter: boolean;
  setRtsFilter: (v: boolean) => void;
}

export default function SmartSearchInput({
  searchType,
  setSearchType,
  searchValue,
  setSearchValue,
  selectedStatuses,
  setSelectedStatuses,
  statusOptions,
  rtsFilter,
  setRtsFilter,
}: SmartSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleSelect = (type: "general" | "batch" | "lot") => {
    setSearchType(type);
    setOpen(false);
  };

  const clearBadge = () => {
    setSearchType("general");
    setSearchValue("");
  };

  const clearStatus = () => {
    setSelectedStatuses([]);
    setRtsFilter(false);
    setSearchType("general");
    setStatusOpen(false);
  };

  const toggleStatus = (value: string) => {
    setSelectedStatuses(
      selectedStatuses.includes(value)
        ? selectedStatuses.filter((s) => s !== value)
        : [...selectedStatuses, value]
    );
  };

  const handleRtsToggle = () => {
    const next = !rtsFilter;
    setRtsFilter(next);
    if (next && searchType !== "status") setSearchType("status");
    if (!next && selectedStatuses.length === 0) setSearchType("general");
  };

  const openStatusFilter = () => {
    setSearchType("status");
    setSearchValue("");
    setOpen(false);
    setStatusOpen(true);
  };

  const badgeLabel: Record<string, string> = { batch: "Batch ID", lot: "Lot #" };

  const badgeText = selectedStatuses.length > 0
    ? `Status (${selectedStatuses.length})${rtsFilter ? " ⚡" : ""}`
    : rtsFilter ? "⚡ RTS" : "Status";

  const hasActiveFilter = selectedStatuses.length > 0 || rtsFilter;

  return (
    <div ref={containerRef} className="relative w-full xl:w-[350px]">
      <div className="flex h-11 items-center rounded-lg border border-gray-300 bg-transparent shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 focus-within:ring-3 focus-within:ring-brand-500/10 focus-within:border-brand-300 dark:focus-within:border-brand-800 transition-shadow px-3 gap-2">
        <span className="text-gray-500 dark:text-gray-400 shrink-0 flex items-center justify-center">
          <SearchOneIcon />
        </span>

        {searchType !== "general" && searchType !== "status" && (
          <span className="flex items-center gap-1 bg-brand-500/10 text-brand-500 text-xs font-medium px-2 py-1 rounded">
            {badgeLabel[searchType] ?? searchType}
            <button type="button" onClick={clearBadge} className="hover:text-brand-700 transition">
              <svg className="size-3" viewBox="0 0 14 14" fill="none">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
        )}

        {searchType === "status" && (
          <span className="flex items-center gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium px-2 py-1 rounded">
            <button
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
              className="hover:text-violet-700 dark:hover:text-violet-300 transition"
            >
              {badgeText}
            </button>
            <button type="button" onClick={clearStatus} className="hover:text-violet-700 dark:hover:text-violet-300 transition">
              <svg className="size-3" viewBox="0 0 14 14" fill="none">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
        )}

        <input
          type="text"
          placeholder={
            searchType === "status" ? "" : searchType === "general" ? "Search orders..." : "Enter value..."
          }
          value={searchValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val.toLowerCase().startsWith("status:")) {
              openStatusFilter();
              return;
            }
            setSearchValue(val);
            if (searchType === "general") setOpen(true);
          }}
          onFocus={() => {
            if (searchType === "general") setOpen(true);
          }}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none dark:text-white/90 dark:placeholder:text-white/30 w-full min-w-0"
        />
      </div>

      {/* Suggestions dropdown */}
      {open && searchType === "general" && (
        <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-theme-lg z-50 overflow-hidden">
          <div className="p-1">
            {searchValue && (
              <>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
                  onClick={() => handleSelect("general")}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-600 shadow-theme-xs transition-colors">
                    <SearchOneIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      Search general for <span className="text-brand-500">"{searchValue}"</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Search across all fields</p>
                  </div>
                </button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2" />
              </>
            )}

            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10 group"
              onClick={() => handleSelect("batch")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 group-hover:bg-white dark:group-hover:bg-brand-500/30 shadow-theme-xs transition-colors">
                <CheckCircleIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  Search Batch ID {searchValue && <span className="text-brand-500">"{searchValue}"</span>}
                </p>
                <p className="text-xs text-brand-600/70 dark:text-brand-400/70">Find orders matching exact batch</p>
              </div>
            </button>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2" />

            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors hover:bg-success-50 dark:hover:bg-success-500/10 group"
              onClick={() => handleSelect("lot")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400 group-hover:bg-white dark:group-hover:bg-success-500/30 shadow-theme-xs transition-colors">
                <BoxIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  Search Lot # {searchValue && <span className="text-success-600 dark:text-success-400">"{searchValue}"</span>}
                </p>
                <p className="text-xs text-success-600/70 dark:text-success-400/70">Find orders in this lot</p>
              </div>
            </button>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2" />

            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors hover:bg-violet-50 dark:hover:bg-violet-500/10 group"
              onClick={openStatusFilter}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 group-hover:bg-white dark:group-hover:bg-violet-500/30 shadow-theme-xs transition-colors">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Filter by Status / RTS</p>
                <p className="text-xs text-violet-600/70 dark:text-violet-400/70">Select statuses or RTS only</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Status + RTS multi-select dropdown */}
      {statusOpen && (
        <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-theme-lg z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto p-1">
            {/* RTS row */}
            <button
              type="button"
              onClick={handleRtsToggle}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  rtsFilter ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {rtsFilter && (
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">⚡ RTS Only</span>
            </button>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2" />

            {statusOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleStatus(value)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    selectedStatuses.includes(value)
                      ? "border-violet-500 bg-violet-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {selectedStatuses.includes(value) && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </button>
            ))}
          </div>
          {hasActiveFilter && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {[rtsFilter && "RTS", selectedStatuses.length > 0 && `${selectedStatuses.length} status`]
                  .filter(Boolean).join(", ")} selected
              </span>
              <button
                type="button"
                onClick={() => { setSelectedStatuses([]); setRtsFilter(false); }}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
