import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../ui/table";
import Input from "../../form/input/InputField";
import { SearchOneIcon, FileIcon, AngleLeftIcon, AngleRightIcon } from "../../../icons";
import Select from "../../form/Select";
import Button from "../../ui/button/Button";
import ComponentTableCard from "../../common/ComponentTableCard";
import { TabDefault, TabOption } from "../../ui/tabs";
import CheckboxCustom from "../../form/input/CheckboxCustom";

export type SortDir = "asc" | "desc";

export type LayoutPlan = "toolbar" | "header" | unknown;

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
    classNameTableCell?: string;
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
            <img
                className="h-[8%] w-[8%] object-contain"
                src="/images/stickers/Shocked Cat Sticker.gif"
                alt="Loading..."
            />
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
            <Button
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${activeCount > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-stroke bg-white text-black hover:bg-gray-1 dark:border-white/[0.05] dark:bg-boxdark dark:text-white dark:hover:bg-meta-4"
                    }`}
            >
                <Ico.Filter />
                Filter
                {activeCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                        {activeCount}
                    </span>
                )}
            </Button>

            {open && (
                <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-stroke bg-white mt-2 p-4 shadow-md dark:border-white/[0.05] dark:bg-boxdark">
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
                        <Button
                            onClick={() => filters.forEach((f) => onChange(f.paramKey, ""))}
                            className="mt-2 w-full rounded border border-stroke py-1.5 text-xs text-body transition hover:border-danger hover:text-danger dark:border-white/[0.05] dark:bg-boxdark"
                        >
                            Clear all
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export interface DataTableProps<T extends object> {
    // ── Data ──────────────────────────────────────────────────────────────────
    columns: ColumnDef<T>[];
    /** Static data — client-side sort/filter/page */
    data?: T[];
    /** Async fetch — server-side, ใช้อย่างใดอย่างหนึ่ง */
    fetchFn?: (params: FetchParams) => Promise<FetchResult<T>>;
    rowKey: keyof T;

    // ── Header or LayoutPlan ────────────────────────────────────────────────────────────────
    title?: string;
    subtitle?: string;
    /** Buttons ฝั่งขวา header (Add Product ฯลฯ) */
    headerActions?: ReactNode;
    /** แสดงเมื่อมี row ถูก select */
    bulkActions?: (selectedRows: T[], isAllSelected: boolean) => ReactNode;

    // ── Toolbar or LayoutPlan ───────────────────────────────────────────────────────────────
    searchable?: LayoutPlan;
    searchPlaceholder?: string;
    filters?: FilterConfig[];
    tabs?: TabOption[];
    tabValue?: string;
    onTabChange?: (value: string) => void;
    exportable?: LayoutPlan;
    exportFilename?: string;
    /** Replaces the inert Filter button in the card header */
    headerFilter?: ReactNode;
    /** Extra content rendered at the right end of the toolbar (after export button) */
    toolbarExtra?: ReactNode;
    pageSizeOptions?: number[];
    defaultPageSize?: number;

    // ── Scroll mode ───────────────────────────────────────────────────────────
    /**
     * เมื่อ true จะซ่อน pagination แล้วแสดงทุก row ใน scroll container
     * ความสูงของ container = defaultPageSize * rowHeight (px)
     */
    scrollable?: boolean;
    /**
     * ความสูงของแต่ละ row (px) ใช้คำนวณ max-height ของ scroll container
     * default: 57
     */
    rowHeight?: number;
    /** override max-height ของ scroll container โดยตรง (px) — ถ้าระบุจะ override defaultPageSize * rowHeight */
    scrollMaxHeight?: number;
    /** ทำให้ card กางเต็มความสูง parent — ใช้คู่กับ scrollable, tbody scroll ใน flex container แทน maxHeight */
    fillHeight?: boolean;
    /** ทำให้ column แรก sticky ทางซ้าย — ช่วยเมื่อ column เกินกว้างตาราง */
    stickyFirstColumn?: boolean;

    // ── Rows ──────────────────────────────────────────────────────────────────
    selectable?: boolean;
    onSelectableChange?: (selectedRows: T[]) => void;
    rowActions?: RowAction<T>[];
    onRowClick?: (row: T) => void;
    /** เรียกเมื่อกดแถวค้าง (touch long-press) เกิน longPressMs ms — ไม่ trigger onRowClick ที่ตามมา */
    onRowLongPress?: (row: T) => void;
    /** ระยะเวลาที่ต้องกดค้างถึงจะถือว่าเป็น long-press (ms) */
    longPressMs?: number;
    /** key value ของ row ที่ต้องการ highlight (ใช้ค่า rowKey field) */
    selectedRowKey?: unknown;

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

export default function DataTableOne<T extends object>({
    columns,
    data: staticData,
    fetchFn,
    rowKey,
    title,
    subtitle,
    headerActions,
    bulkActions,
    searchable = "",
    searchPlaceholder = "Search...",
    filters: filterConfigs,
    tabs = [],
    tabValue,
    onTabChange,
    exportable = "",
    exportFilename = "export.csv",
    headerFilter,
    toolbarExtra,
    pageSizeOptions = [10, 25, 50],
    defaultPageSize = 10,
    scrollable = false,
    rowHeight = 57,
    scrollMaxHeight: scrollMaxHeightProp,
    fillHeight = false,
    stickyFirstColumn = false,
    selectable = false,
    onSelectableChange,
    rowActions = [],
    onRowClick,
    onRowLongPress,
    longPressMs = 500,
    selectedRowKey,
    loading: loadingProp,
    emptyText = "No data found",
    className = "",
}: DataTableProps<T>) {
    const isAsync = !!fetchFn;

    // ── State ──────────────────────────────────────────────────────────────────
    const [asyncData, setAsyncData] = useState<T[]>([]);
    const [asyncTotal, setAsyncTotal] = useState(0);
    const [asyncLoading, setAsyncLoading] = useState(false);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const dSearch = useDebounce(search);

    const [sortKey, setSortKey] = useState("");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const [selectedIds, setSelectedIds] = useState<Set<unknown>>(new Set());
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const loading = loadingProp ?? asyncLoading;

    // ── Long-press (touch) ─────────────────────────────────────────────────────
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPressRef = useRef(false);
    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

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

    const total = isAsync ? asyncTotal : clientRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // scroll mode แสดงทุก row, pagination mode slice ตามปกติ
    const visibleRows = useMemo(() => {
        if (scrollable) return clientRows;
        if (isAsync) return clientRows;
        return clientRows.slice((page - 1) * pageSize, page * pageSize);
    }, [scrollable, isAsync, clientRows, page, pageSize]);

    // ── Scroll container height ────────────────────────────────────────────────
    // defaultPageSize * rowHeight = ความสูงเริ่มต้น, row เกินจะ scroll
    const scrollMaxHeight = scrollMaxHeightProp ?? defaultPageSize * rowHeight;


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
            allSelected
                ? visibleRows.forEach((r) => next.delete(getId(r)))
                : visibleRows.forEach((r) => next.add(getId(r)));
            return next;
        });

    const toggleRow = (id: unknown) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const selectedRows = useMemo(
        () => (isAsync ? asyncData : clientRows).filter((r) => selectedIds.has(getId(r))),
        [selectedIds, isAsync, asyncData, clientRows]
    );

    // ── Async fetch ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isAsync || !fetchFn) return;
        let cancelled = false;
        setAsyncLoading(true);
        setError("");
        fetchFn({ page, pageSize, search: dSearch, sortKey, sortDir, filters: filterValues })
            .then((result) => {
                if (!cancelled) { setAsyncData(result.data); setAsyncTotal(result.total); }
            })
            .catch((e) => { if (!cancelled) setError(String(e)); })
            .finally(() => { if (!cancelled) setAsyncLoading(false); });
        return () => { cancelled = true; };
    }, [isAsync, fetchFn, page, pageSize, dSearch, sortKey, sortDir, filterValues]);

    // ── Selection callback ─────────────────────────────────────────────────────
    useEffect(() => {
        onSelectableChange?.(selectedRows);
    }, [selectedRows, onSelectableChange]);

    // ── Pagination ─────────────────────────────────────────────────────────────
    const pageButtons = useMemo(() => {
        const pages: (number | "...")[] = [1];
        const left = Math.max(2, page - 1);
        const right = Math.min(totalPages - 1, page + 1);
        if (left > 2) pages.push("...");
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < totalPages - 1) pages.push("...");
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    }, [page, totalPages]);

    const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, total);

    const alignClass = (a?: string) =>
        a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

    const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions.length ? 1 : 0);

    // ── scrollable layout ────────────────────────────────────────────────────────
    // thead/tbody เป็น display:block siblings → outer wrapper overflow-x-auto เลื่อน
    //   X ทั้งสองก้อนไปพร้อมกัน (header + body sync) โดยไม่ต้องใช้ JS
    // tbody มี overflow-y:auto (ไม่ใช่ scroll) → scrollbar Y โผล่เฉพาะเมื่อ row เกิน
    //   → ไม่มี reserved gutter, scrollbar Y อยู่แค่ฝั่งแถวข้อมูล (ไม่พาดหัวตาราง)
    // tr ใช้ display:table + tableLayout:fixed + width:100% → column alignment
    //   ระหว่าง thead/tbody ตรงกัน
    // !fillHeight: thead/tbody display:block + tbody overflow-y:auto → scrollbar Y ใน tbody
    // fillHeight: ใช้ 2 div แยก (header + body) + JS sync X → scrollbar Y ติดขอบ body div
    const theadScrollStyle: React.CSSProperties | undefined = scrollable && !fillHeight
        ? { display: "block", position: "relative", zIndex: 1 }
        : undefined;

    // overflowX:hidden สำคัญ: ถ้าไม่ระบุ CSS spec จะอัปเกรด overflow-x เป็น auto อัตโนมัติ
    //   เมื่อ overflow-y เป็น auto → เกิด X scrollbar บน tbody ซ้อนกับ outer wrapper (2 อัน)
    const tbodyScrollStyle: React.CSSProperties | undefined = scrollable && !fillHeight
        ? { display: "block", maxHeight: scrollMaxHeight, overflowX: "hidden", overflowY: "auto" }
        : undefined;

    const trScrollStyle: React.CSSProperties | undefined = scrollable && !fillHeight
        ? { display: "table", width: "100%", tableLayout: "fixed" }
        : undefined;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <ComponentTableCard
            title={title}
            desc={subtitle}
            headerActions={headerActions}
            className={`${fillHeight ? "lg:flex lg:flex-col lg:h-full lg:min-h-0" : ""}${className ? ` ${className}` : ""}`}
            classNameBody={`sm:!p-0${fillHeight ? " lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:!p-0" : ""}`}
            classNameBodyInner={fillHeight ? "lg:flex lg:flex-col lg:flex-1 lg:min-h-0" : undefined}
            divider={(
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-4 sm:py-5">
                    {searchable === 'header' && (
                        <div className="relative min-w-[140px] flex-1">
                            <span className="absolute z-1 top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                <SearchOneIcon />
                            </span>
                            <Input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-11 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                            />
                        </div>
                    )}
                    {/* Mobile: compact segmented group */}
                    {(headerFilter || exportable === "header") && (
                        <div className="flex sm:hidden items-center gap-x-1.5">
                            {headerFilter}
                            {exportable === "header" && (
                                <button
                                    className="flex items-center justify-center h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-theme-xs transition-colors"
                                    onClick={() => exportCsv(columns, isAsync ? asyncData : clientRows, exportFilename)}
                                >
                                    <FileIcon className="size-5" />
                                </button>
                            )}
                        </div>
                    )}
                    {/* Desktop: separate buttons */}
                    <div className="hidden sm:contents">
                        {headerFilter}
                        {exportable === "header" && (
                            <Button
                                size="sm"
                                variant="outline"
                                startIcon={<FileIcon className="size-5" />}
                                onClick={() => exportCsv(columns, isAsync ? asyncData : clientRows, exportFilename)}
                                className="relative"
                            >
                                Export
                            </Button>
                        )}
                    </div>
                </div>
            )}
        >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-gray-100 px-0 sm:px-6 py-4 dark:border-white/[0.05] !mb-0">
                {/* Left controls */}
                <div className="flex flex-1 items-center gap-3 min-w-0">
                    {searchable === 'toolbar' && (
                        <div className="relative max-w-xs flex-1">
                            <span className="absolute z-50 top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                <SearchOneIcon />
                            </span>
                            <Input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-100 bg-transparent py-2.5 pr-4 pl-11 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden sm:w-[300px] sm:min-w-[300px] dark:border-white/[0.05] dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                            />
                        </div>
                    )}
                    {tabs?.length > 0 && (
                        <div className="relative overflow-x-auto">
                            <TabDefault options={tabs} defaultValue={tabValue} onChange={onTabChange} />
                        </div>
                    )}
                    {/* Desktop: inline badge */}
                    {selectedIds.size > 0 && (
                        <div className="hidden sm:flex items-center gap-2 rounded bg-primary/10 px-3 py-1 text-sm text-primary">
                            <p className="text-sm text-gray-800 dark:text-gray-200">{selectedIds.size} selected</p>
                            {bulkActions && bulkActions(selectedRows, allSelected)}
                        </div>
                    )}
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Page size — ซ่อนเมื่อ scrollable */}
                    {!scrollable && pageSizeOptions.length > 1 && (
                        <>
                            <span className="hidden sm:inline text-gray-500 dark:text-gray-400">Show</span>
                            <Select
                                defaultValue={'' + pageSize}
                                options={pageSizeOptions.map((s) => ({ value: '' + s, label: '' + s }))}
                                placeholder={null}
                                onChange={(value) => { setPageSize(Number(value)); setSelectedIds(new Set()); }}
                            />
                            <span className="hidden sm:inline text-gray-500 dark:text-gray-400">entries</span>
                        </>
                    )}

                    {/* Total badge — แสดงเมื่อ scrollable */}
                    {scrollable && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {total} Items
                        </span>
                    )}

                    {filterConfigs && filterConfigs.length > 0 && (
                        <FilterPanel
                            filters={filterConfigs}
                            values={filterValues}
                            onChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
                        />
                    )}

                    {exportable === "toolbar" && (
                        <Button
                            size="sm"
                            variant="outline"
                            startIcon={<FileIcon className="size-5" />}
                            onClick={() => exportCsv(columns, isAsync ? asyncData : clientRows, exportFilename)}
                            className="relative"
                        >
                            Export
                        </Button>
                    )}
                    {toolbarExtra}
                </div>

                {/* Mobile: full-width selection bar */}
                {selectedIds.size > 0 && (
                    <div className="flex sm:hidden w-full items-center justify-between gap-3 rounded-lg bg-primary/10 px-4 py-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {selectedIds.size} selected
                        </p>
                        {bulkActions && (
                            <div>{bulkActions(selectedRows, allSelected)}</div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Table ────────────────────────────────────────────────────────── */}
            {(() => {
                // fillHeight: th sticky top-0 → follows X scroll, sticks on Y scroll (single table, no JS sync needed)
                // !fillHeight: no sticky top, stickyFirstColumn only
                const getThClass = (idx: number) => {
                    if (fillHeight && stickyFirstColumn && idx === 0)
                        return "sticky top-0 left-0 z-30 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-[#1e2636]";
                    if (fillHeight)
                        return "sticky top-0 z-20 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-[#1e2636]";
                    if (stickyFirstColumn && idx === 0)
                        return "sticky left-0 z-20 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-[#1e2636]";
                    return "";
                };

                const headerCells = columns.map((col, idx) => (
                    <TableCell
                        isHeader
                        key={col.key}
                        onClick={() => col.sortable && handleSort(col.key)}
                        style={{ width: col.width }}
                        className={`p-4 whitespace-nowrap font-medium text-gray-700 dark:text-gray-400 ${alignClass(col.align)} ${col.sortable ? "cursor-pointer select-none" : ""} ${getThClass(idx)}`}
                    >
                        <div className={`flex items-center gap-3 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
                            {selectable && idx === 0 && (
                                <CheckboxCustom
                                    className="!w-4 !h-4 !rounded-sm"
                                    width="15"
                                    height="15"
                                    viewBox="0 0 18 14"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                            <p className="text-theme-xs">{col.label}</p>
                            {col.sortable && <SortIcon k={col.key} />}
                        </div>
                    </TableCell>
                ));

                const bodyRows = loading ? (
                    <TableRow style={trScrollStyle}>
                        <TableCell colSpan={colSpan} className="px-5 py-4 sm:px-6 text-start">
                            <Spinner />
                        </TableCell>
                    </TableRow>
                ) : error ? (
                    <TableRow style={trScrollStyle}>
                        <TableCell colSpan={colSpan} className="px-5 py-4 sm:px-6 text-start text-sm text-danger">
                            {error}
                        </TableCell>
                    </TableRow>
                ) : visibleRows.length === 0 ? (
                    <TableRow style={trScrollStyle}>
                        <TableCell colSpan={colSpan} className="px-5 py-4 sm:px-6 text-start text-sm text-gray-500 dark:text-gray-400">
                            {emptyText}
                        </TableCell>
                    </TableRow>
                ) : (
                    visibleRows.map((row, rowIndex) => {
                        const id = getId(row);
                        const isSelected = selectedIds.has(id);
                        return (
                            <TableRow
                                key={String(id)}
                                style={trScrollStyle}
                                onClick={() => {
                                    if (didLongPressRef.current) {
                                        didLongPressRef.current = false;
                                        return;
                                    }
                                    onRowClick?.(row);
                                }}
                                onMouseDown={(e) => {
                                    if (!onRowLongPress || e.button !== 0) return;
                                    didLongPressRef.current = false;
                                    clearLongPress();
                                    longPressTimerRef.current = setTimeout(() => {
                                        didLongPressRef.current = true;
                                        onRowLongPress(row);
                                    }, longPressMs);
                                }}
                                onMouseUp={clearLongPress}
                                onMouseLeave={clearLongPress}
                                onTouchStart={() => {
                                    if (!onRowLongPress) return;
                                    didLongPressRef.current = false;
                                    clearLongPress();
                                    longPressTimerRef.current = setTimeout(() => {
                                        didLongPressRef.current = true;
                                        onRowLongPress(row);
                                    }, longPressMs);
                                }}
                                onTouchMove={clearLongPress}
                                onTouchEnd={clearLongPress}
                                onTouchCancel={clearLongPress}
                                className={`border-b border-gray-100 last:border-0 transition-shadow duration-300 ease-in-out dark:border-white/[0.05] ${(onRowClick || onRowLongPress) ? "cursor-pointer" : ""} ${String(id) === String(selectedRowKey) ? "bg-gray-50 dark:bg-gray-50/10" : isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-1/60 dark:hover:bg-meta-4/40"}`}
                            >
                                {columns.map((col, idx) => {
                                    const val = getNestedValue(row, col.key);
                                    return (
                                        <TableCell
                                            key={col.key}
                                            style={{ width: col.width }}
                                            className={`p-4 ${col.classNameTableCell ?? ""} ${alignClass(col.align)} ${stickyFirstColumn && idx === 0 ? "sticky left-0 z-10 bg-white dark:bg-gray-900" : ""}`}
                                        >
                                            <div className={`flex items-center gap-3 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
                                                {selectable && idx === 0 && (
                                                    <CheckboxCustom
                                                        className="!w-4 !h-4 !rounded-sm"
                                                        width="15"
                                                        height="15"
                                                        viewBox="0 0 18 14"
                                                        checked={isSelected}
                                                        onChange={() => toggleRow(id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {col.render
                                                    ? col.render(val, row, rowIndex)
                                                    : <span className="text-theme-xs font-medium text-gray-700 group-hover:underline dark:text-gray-400">{String(val ?? "—")}</span>
                                                }
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })
                );

                // fillHeight: single table, th sticky top-0 — header scrolls with body on X, sticks on Y
                if (fillHeight) return (
                    <div className="lg:flex-1 lg:min-h-0 overflow-auto custom-scrollbar">
                        <Table className="table-fixed">
                            <TableHeader>
                                <TableRow>{headerCells}</TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {bodyRows}
                            </TableBody>
                        </Table>
                    </div>
                );

                // !fillHeight: single table, thead/tbody display:block, scrollbar Y ใน tbody
                return (
                    <div className="max-w-full overflow-x-auto custom-scrollbar mb-0">
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]" style={theadScrollStyle}>
                                <TableRow style={trScrollStyle}>{headerCells}</TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05] custom-scrollbar" style={tbodyScrollStyle}>
                                {bodyRows}
                            </TableBody>
                        </Table>
                    </div>
                );
            })()}

            {/* Footer — ซ่อนเมื่อ scrollable */}
            {!scrollable && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/[0.05]">
                    <p className="text-sm text-body dark:text-gray-400">
                        {total === 0 ? "No records" : (
                            <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                                Showing{" "}
                                <span className="text-gray-800 dark:text-white/90">{startRow}</span>
                                {" "}to{" "}
                                <span className="text-gray-800 dark:text-white/90">{endRow}</span>
                                {" "}of{" "}
                                <span className="text-gray-800 dark:text-white/90">{total}</span>
                            </span>
                        )}
                    </p>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            startIcon={<AngleLeftIcon className="size-5" />}
                            className="h-10 w-10 disabled:opacity-50"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            <></>
                        </Button>

                        {pageButtons.map((p, i) =>
                            p === "..." ? (
                                <span key={`e${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-body">…</span>
                            ) : (
                                <Button
                                    key={p}
                                    variant={page === p ? 'primary' : 'outline'}
                                    className="flex h-10 w-10 text-gray-800 dark:text-white/90"
                                    onClick={() => setPage(p as number)}
                                >
                                    {p}
                                </Button>
                            )
                        )}

                        <Button
                            variant="outline"
                            endIcon={<AngleRightIcon className="size-5" />}
                            className="h-10 w-10 disabled:opacity-50"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                        >
                            <></>
                        </Button>
                    </div>
                </div>
            )}
            {scrollable && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/[0.05]"></div>
            )}
        </ComponentTableCard>
    );
}