/**
 * DataTable.tsx
 * Generic reusable DataTable — Jaonaichan React/TSX
 * Design matches E-commerce Products List style
 *
 * Features:
 *  - Generic <T extends object> — ใช้กับข้อมูลประเภทไหนก็ได้
 *  - Column config พร้อม custom render cell
 *  - Sort / Search / Filter dropdown / Pagination
 *  - Row checkbox selection + bulk action slot
 *  - Export CSV
 *  - "..." action dropdown (configurable per usage)
 *  - Async fetchFn หรือ static data
 *  - Dark mode ครบ
 *
 * Usage: ดู DataTableExample.tsx
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDir = "asc" | "desc";

export interface ColumnDef<T> {
  /** dot-notation path เช่น "billing.first_name" หรือ field ตรงๆ */
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  /** custom render — ถ้าไม่ระบุจะแสดง row[key] */
  render?: (value: unknown, row: T, index: number) => ReactNode;
  /** ซ่อน column นี้ใน CSV */
  noExport?: boolean;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  label: string;
  /** query param key ที่ส่งไป fetchFn และใช้ filter client-side */
  paramKey: string;
  options: FilterOption[];
}

export interface RowAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "danger";
  onClick: (row: T) => void;
}

export interface FetchParams {
  page: number;
  pageSize: number;
  search: string;
  sortKey: string;
  sortDir: SortDir;
  filters: Record<string, string>;
}

export interface FetchResult<T> {
  data: T[];
  total: number;
}

export interface DataTableProps<T extends object> {
  // ── Data ──────────────────────────────────────────────────────────────────
  columns: ColumnDef<T>[];
  /** Static data — client-side sort/filter/page */
  data?: T[];
  /** Async fetch — server-side, ใช้อย่างใดอย่างหนึ่ง */
  fetchFn?: (params: FetchParams) => Promise<FetchResult<T>>;
  rowKey: keyof T;

  // ── Header ────────────────────────────────────────────────────────────────
  title?: string;
  subtitle?: string;
  /** Buttons ฝั่งขวา header (Add Product ฯลฯ) */
  headerActions?: ReactNode;
  /** แสดงเมื่อมี row ถูก select */
  bulkActions?: (selectedRows: T[]) => ReactNode;

  // ── Toolbar ───────────────────────────────────────────────────────────────
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  exportable?: boolean;
  exportFilename?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;

  // ── Rows ──────────────────────────────────────────────────────────────────
  selectable?: boolean;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;

  // ── Misc ──────────────────────────────────────────────────────────────────
  loading?: boolean;
  emptyText?: string;
  className?: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ico = {
  Search: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Download: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Filter: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  SortAsc: () => (
    <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="M7 15l5 5 5-5" />
    </svg>
  ),
  SortDesc: () => (
    <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="M7 9l5-5 5 5" />
    </svg>
  ),
  SortNone: () => (
    <svg className="h-3.5 w-3.5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
    </svg>
  ),
  Dots: () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  ),
  ChevLeft: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevRight: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(val: T, ms = 400) {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return d;
}

function getNestedValue(obj: object, key: string): unknown {
  return key.split(".").reduce((acc: unknown, k) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

function exportCsv<T extends object>(cols: ColumnDef<T>[], rows: T[], filename: string) {
  const exportCols = cols.filter((c) => !c.noExport);
  const headers = exportCols.map((c) => `"${c.label}"`).join(",");
  const body = rows.map((row) =>
    exportCols.map((c) => {
      const v = getNestedValue(row, c.key);
      return `"${String(v ?? "").replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers, ...body].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-stroke border-t-primary" />
    </div>
  );
}

function ActionDropdown<T extends object>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-body transition hover:bg-stroke hover:text-black dark:hover:bg-strokedark dark:hover:text-white"
      >
        <Ico.Dots />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[150px] rounded-md border border-stroke bg-white py-1 shadow-md dark:dark:border-gray-800 dark:bg-boxdark">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick(row); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition ${
                action.variant === "danger"
                  ? "text-danger hover:bg-danger/5"
                  : "text-black hover:bg-gray-1 dark:text-white dark:hover:bg-meta-4"
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  filters,
  values,
  onChange,
}: {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const activeCount = Object.values(values).filter(Boolean).length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
          activeCount > 0
            ? "border-primary bg-primary/5 text-primary"
            : "border-stroke bg-white text-black hover:bg-gray-1 dark:dark:border-gray-800 dark:bg-boxdark dark:text-white dark:hover:bg-meta-4"
        }`}
      >
        <Ico.Filter />
        Filter
        {activeCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-stroke bg-white p-4 shadow-md dark:dark:border-gray-800 dark:bg-boxdark">
          {filters.map((f) => (
            <div key={f.paramKey} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                {f.label}
              </p>
              {f.options.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2.5 py-1.5">
                  <input
                    type="radio"
                    name={f.paramKey}
                    value={opt.value}
                    checked={(values[f.paramKey] ?? "") === opt.value}
                    onChange={() => onChange(f.paramKey, opt.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-black dark:text-white">{opt.label}</span>
                </label>
              ))}
            </div>
          ))}
          {activeCount > 0 && (
            <button
              onClick={() => filters.forEach((f) => onChange(f.paramKey, ""))}
              className="mt-2 w-full rounded border border-stroke py-1.5 text-xs text-body transition hover:border-danger hover:text-danger dark:dark:border-gray-800"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DataTable (main) ─────────────────────────────────────────────────────────

export default function DataTable<T extends object>({
  columns,
  data: staticData,
  fetchFn,
  rowKey,
  title,
  subtitle,
  headerActions,
  bulkActions,
  searchable = true,
  searchPlaceholder = "Search...",
  filters: filterConfigs,
  exportable = true,
  exportFilename = "export.csv",
  pageSizeOptions = [7, 10, 25, 50],
  defaultPageSize = 10,
  selectable = true,
  rowActions = [],
  onRowClick,
  loading: loadingProp,
  emptyText = "No data found",
  className = "",
}: DataTableProps<T>) {
  const isAsync = !!fetchFn;

  // ── State ──────────────────────────────────────────────────────────────────
  const [asyncData, setAsyncData]   = useState<T[]>([]);
  const [asyncTotal, setAsyncTotal] = useState(0);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const dSearch = useDebounce(search);

  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const [selectedIds, setSelectedIds] = useState<Set<unknown>>(new Set());
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);
  const loading = loadingProp ?? asyncLoading;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const doFetch = useCallback(async () => {
    if (!fetchFn) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAsyncLoading(true);
    setError("");
    try {
      const res = await fetchFn({ page, pageSize, search: dSearch, sortKey, sortDir, filters: filterValues });
      setAsyncData(res.data);
      setAsyncTotal(res.total);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Failed to load data");
    } finally {
      setAsyncLoading(false);
    }
  }, [fetchFn, page, pageSize, dSearch, sortKey, sortDir, filterValues]);

  useEffect(() => { doFetch(); }, [doFetch]);
  useEffect(() => { setPage(1); }, [dSearch, sortKey, sortDir, pageSize, filterValues]);

  // ── Client-side data ───────────────────────────────────────────────────────
  const clientRows = useMemo(() => {
    if (isAsync) return asyncData;
    let rows = [...(staticData ?? [])];

    if (dSearch) {
      const q = dSearch.toLowerCase();
      rows = rows.filter((row) =>
        columns.some((col) => String(getNestedValue(row, col.key) ?? "").toLowerCase().includes(q))
      );
    }

    filterConfigs?.forEach((fc) => {
      const val = filterValues[fc.paramKey];
      if (val) rows = rows.filter((row) => String(getNestedValue(row, fc.paramKey) ?? "") === val);
    });

    if (sortKey) {
      rows.sort((a, b) => {
        const av = getNestedValue(a, sortKey);
        const bv = getNestedValue(b, sortKey);
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "th");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [isAsync, asyncData, staticData, dSearch, sortKey, sortDir, filterValues, filterConfigs, columns]);

  const total      = isAsync ? asyncTotal : clientRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const visibleRows = useMemo(() => {
    if (isAsync) return clientRows;
    return clientRows.slice((page - 1) * pageSize, page * pageSize);
  }, [isAsync, clientRows, page, pageSize]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: string }) =>
    sortKey !== k ? <Ico.SortNone /> : sortDir === "asc" ? <Ico.SortAsc /> : <Ico.SortDesc />;

  // ── Selection ──────────────────────────────────────────────────────────────
  const getId = (row: T) => (row as Record<string, unknown>)[rowKey as string];
  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(getId(r)));

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleRows.forEach((r) => next.delete(getId(r)));
      else visibleRows.forEach((r) => next.add(getId(r)));
      return next;
    });

  const toggleRow = (id: unknown) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRows = useMemo(
    () => (isAsync ? asyncData : clientRows).filter((r) => selectedIds.has(getId(r))),
    [selectedIds, isAsync, asyncData, clientRows]
  );

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageButtons = useMemo(() => {
    const pages: (number | "...")[] = [1];
    const left  = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow   = Math.min(page * pageSize, total);

  const alignClass = (a?: string) =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions.length ? 1 : 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-sm border border-stroke bg-white shadow-default dark:dark:border-gray-800 dark:bg-boxdark ${className}`}>

      {/* Header */}
      {(title || headerActions) && (
        <div className="flex items-start justify-between px-6 py-5">
          {title && (
            <div>
              <h4 className="text-xl font-bold text-black dark:text-white">{title}</h4>
              {subtitle && <p className="mt-0.5 text-sm text-body dark:text-bodydark">{subtitle}</p>}
            </div>
          )}
          {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selectedRows.length > 0 && bulkActions && (
        <div className="flex items-center gap-3 border-t border-stroke bg-primary/5 px-6 py-3 dark:dark:border-gray-800">
          <span className="text-sm font-medium text-primary">{selectedRows.length} selected</span>
          {bulkActions(selectedRows)}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-t border-stroke px-6 py-3.5 dark:dark:border-gray-800">
        {/* Search */}
        <div className="flex flex-1 items-center gap-2">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-body">
                <Ico.Search />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-stroke bg-white py-2.5 pl-11 pr-4 text-sm text-black outline-none transition focus:border-primary dark:dark:border-gray-800 dark:bg-boxdark dark:text-white dark:focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {pageSizeOptions.length > 1 && (
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-black outline-none dark:dark:border-gray-800 dark:bg-boxdark dark:text-white"
            >
              {pageSizeOptions.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
          )}

          {filterConfigs && filterConfigs.length > 0 && (
            <FilterPanel
              filters={filterConfigs}
              values={filterValues}
              onChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
            />
          )}

          {exportable && (
            <button
              onClick={() => exportCsv(columns, isAsync ? asyncData : clientRows, exportFilename)}
              className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-gray-1 dark:dark:border-gray-800 dark:bg-boxdark dark:text-white dark:hover:bg-meta-4"
            >
              Export <Ico.Download />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between bg-danger/10 px-6 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={doFetch} className="text-sm font-medium text-danger underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stroke text-left dark:dark:border-gray-800">
              {selectable && (
                <th className="w-12 px-6 py-4">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-stroke accent-primary" />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-3 py-4 text-sm font-medium text-black dark:text-white ${alignClass(col.align)} ${col.sortable ? "cursor-pointer select-none" : ""}`}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
                    {col.label}
                    {col.sortable && <SortIcon k={col.key} />}
                  </div>
                </th>
              ))}
              {rowActions.length > 0 && <th className="w-14 px-3 py-4" />}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan}><Spinner /></td></tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-20 text-center text-sm text-body dark:text-bodydark">
                  {emptyText}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rowIndex) => {
                const id = getId(row);
                const isSelected = selectedIds.has(id);
                return (
                  <tr
                    key={String(id)}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-stroke last:border-0 transition-colors dark:dark:border-gray-800 ${onRowClick ? "cursor-pointer" : ""} ${isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-1/60 dark:hover:bg-meta-4/40"}`}
                  >
                    {selectable && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(id)}
                          className="h-4 w-4 cursor-pointer rounded border-stroke accent-primary" />
                      </td>
                    )}
                    {columns.map((col) => {
                      const val = getNestedValue(row, col.key);
                      return (
                        <td key={col.key} className={`px-3 py-4 text-sm ${alignClass(col.align)}`}>
                          {col.render
                            ? col.render(val, row, rowIndex)
                            : <span className="text-body dark:text-bodydark">{String(val ?? "—")}</span>}
                        </td>
                      );
                    })}
                    {rowActions.length > 0 && (
                      <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                        <ActionDropdown row={row} actions={rowActions} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke px-6 py-4 dark:dark:border-gray-800">
        <p className="text-sm text-body dark:text-bodydark">
          {total === 0 ? "No records" : (
            <Fragment>
              Showing{" "}
              <span className="font-semibold text-black dark:text-white">{startRow}</span>
              {" "}to{" "}
              <span className="font-semibold text-black dark:text-white">{endRow}</span>
              {" "}of{" "}
              <span className="font-semibold text-black dark:text-white">{total}</span>
            </Fragment>
          )}
        </p>

        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-black transition hover:border-primary hover:text-primary disabled:opacity-40 dark:dark:border-gray-800 dark:text-white">
            <Ico.ChevLeft />
          </button>

          {pageButtons.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-body">…</span>
            ) : (
              <button key={p} onClick={() => setPage(p as number)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition ${page === p ? "border-primary bg-primary text-white" : "border-stroke text-black hover:border-primary hover:text-primary dark:dark:border-gray-800 dark:text-white"}`}>
                {p}
              </button>
            )
          )}

          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-black transition hover:border-primary hover:text-primary disabled:opacity-40 dark:dark:border-gray-800 dark:text-white">
            <Ico.ChevRight />
          </button>
        </div>
      </div>
    </div>
  );
}
