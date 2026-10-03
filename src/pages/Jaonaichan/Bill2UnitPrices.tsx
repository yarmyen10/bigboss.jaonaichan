import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageSpinner from "../../components/common/PageSpinner";
import Button from "../../components/ui/button/Button";
import { AlertModal } from "../../components/ui/modal/AlertModal";
import { Order, OrderProductsBulkItem } from "../../interfaces/order.jaonaichan";
import { getOrders, getProductsBulkByOrders, patchBill2, patchOrderStatus } from "../../services/jaonaichan";
import {
  Bill2Group, CHINA_PCT, IMPORT_PCT, RowBaseline, SortKey, baselineOf, buildPatches, categoryOptions, groupLines,
  isEditable, isPublished, memberOptions, parseSort, sortGroups, toLines,
} from "../../utils/bill2Rows";

// Spec: Trello "Bill 2 Unit Prices > New Mock". Category + Member filter → one row per (product code, price) → the admin types China/Import
// as a TOTAL for the row; it is split by qty over every customer's Bill 2 (see utils/bill2Rows.ts).

type Field = "extraItems" | "extraShip" | "china" | "importFee";
type Edits = Record<string, Partial<Record<Field, string>>>;

const FIELD_LABEL: Record<Field, string> = { extraItems: "Extra Items", extraShip: "Extra Ship", china: "China Ship", importFee: "Import Fee" };
const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const strip = (v: string) => {
  const raw = v.replace(/[^\d.]/g, "");
  const [a, ...rest] = raw.split(".");
  return rest.length ? `${a}.${rest.join("").slice(0, 2)}` : a;
};

function generateBatchId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function fetchAll(): Promise<{ orders: Order[]; items: OrderProductsBulkItem[] }> {
  // every page — the old page read only the first 100 orders and silently dropped the rest
  const first = await getOrders({ status: "paid-1,pending-payment-2", perPage: 100, page: 1 });
  let orders: Order[] = first?.data ?? [];
  const pages = first?.pagination?.total_pages ?? 1;
  for (let p = 2; p <= pages; p++) orders = orders.concat((await getOrders({ status: "paid-1,pending-payment-2", perPage: 100, page: p }))?.data ?? []);
  orders = orders.filter(o => !o.is_rts);
  if (orders.length === 0) return { orders, items: [] };
  const orderIds = orders.map(o => o.id);
  const firstItems = await getProductsBulkByOrders({ orderIds, perPage: 100 });
  let items: OrderProductsBulkItem[] = firstItems?.data ?? [];
  for (let p = 2; p <= (firstItems?.pagination?.total_pages ?? 1); p++) items = items.concat((await getProductsBulkByOrders({ orderIds, perPage: 100, page: p }))?.data ?? []);
  return { orders, items };
}

// ─── small pieces ────────────────────────────────────────────────────────────

function MoneyInput({ value, onChange, label, invalid }: { value: string; onChange: (v: string) => void; label: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">฿</span>
      <input
        aria-label={label}
        data-invalid={invalid ? "true" : undefined}
        inputMode="decimal"
        value={value}
        onChange={e => onChange(strip(e.target.value))}
        onFocus={e => e.target.select()}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className={`h-10 w-full rounded-lg border bg-transparent py-2 pl-6 pr-2 text-right text-sm font-semibold text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
          invalid
            ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
            : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700"
        }`}
      />
    </div>
  );
}

interface Opt { value: string; label: string; sub?: string; chip?: string }

function SearchSelect({ label, hint, value, options, onChange, placeholder, disabled, searchable, allLabel, allChip }: {
  label: string; hint?: string; value: string; options: Opt[]; onChange: (v: string) => void; placeholder: string;
  disabled?: boolean; searchable?: boolean; allLabel?: string; allChip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const all: Opt[] = allLabel ? [{ value: "", label: allLabel, chip: allChip }, ...options] : options;
  const shown = q ? all.filter(o => o.value !== "" && `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase())) : all;
  const cur = all.find(o => o.value === value);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); };

  return (
    <div ref={box} className="relative w-full sm:w-72">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label} {hint && <span className="font-normal normal-case text-gray-400">({hint})</span>}
      </p>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-transparent px-3 text-left text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:text-white/90 dark:disabled:bg-gray-800"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`truncate ${cur ? "" : "text-gray-400"}`}>{cur ? cur.label : placeholder}</span>
          {cur?.chip && <span className="shrink-0 rounded-full bg-brand-50 px-2 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">{cur.chip}</span>}
        </span>
        <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="none"><path d="M4.8 7.4 10 12.6l5.2-5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {searchable && (
            <input
              autoFocus
              aria-label={`ค้นหา ${label}`}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="พิมพ์ค้นหา…"
              className="mb-2 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
            />
          )}
          <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">ไม่พบรายการ</li>}
            {shown.map(o => (
              <li key={o.value || "__all"} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 ${o.value === value ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10" : "text-gray-700 dark:text-gray-300"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.sub && <span className="block text-xs text-gray-400">{o.sub}</span>}
                  </span>
                  {o.chip && <span className="shrink-0 rounded-full bg-gray-100 px-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{o.chip}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, tone, label, children }: { icon: string; tone: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${tone}`} aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800 dark:text-white/90">{children}</p>
      </div>
    </div>
  );
}

const variantText = (g: Bill2Group) =>
  g.flavors.length === 0
    ? `สินค้าเดี่ยว · ฿${fmt(g.unitPrice)}`
    : g.isPriceSplit
      ? `รส: ${g.flavors.join(", ")} · ฿${fmt(g.unitPrice)}`
      : `${g.flavors.length} รสชาติ · รวมทั้งหมด`;

// ─── page ────────────────────────────────────────────────────────────────────

export default function Bill2UnitPrices() {
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderProductsBulkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Edits>({});
  const [localShipping, setLocalShipping] = useState("");
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "publish" | "resetAll">(null);
  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await fetchAll();
      setOrders(r.orders);
      setItems(r.items);
    } catch (err) {
      setLoadError(true);
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // ── scope ──
  const editableOrders = useMemo(() => orders.filter(isEditable), [orders]);
  const allLines = useMemo(() => toLines(items, editableOrders), [items, editableOrders]);
  const { options: categories, fallback: categoryFallback } = useMemo(() => categoryOptions(allLines), [allLines]);
  const category = categories.find(c => c.id === Number(params.get("category"))) ?? null;
  const catLines = useMemo(() => (category ? allLines.filter(l => l.categoryIds.includes(category.id)) : []), [allLines, category]);
  const members = useMemo(() => memberOptions(catLines), [catLines]);
  const member = members.find(m => m.id === Number(params.get("member"))) ?? null;
  const scopeLines = useMemo(() => (member ? catLines.filter(l => l.customerId === member.id) : catLines), [catLines, member]);
  const sort = parseSort(params.get("sort"));
  const groups = useMemo(() => sortGroups(groupLines(scopeLines), sort), [scopeLines, sort.key, sort.dir]);  // eslint-disable-line react-hooks/exhaustive-deps
  const baselines = useMemo(() => new Map(groups.map(g => [g.key, baselineOf(g)])), [groups]);
  const q = search.trim().toLowerCase();
  const shown = q ? groups.filter(g => `${g.productCode} ${g.productName} ${g.flavors.join(" ")}`.toLowerCase().includes(q)) : groups;
  const scopeOrderIds = useMemo(() => new Set(scopeLines.map(l => l.orderId)), [scopeLines]);
  const scopeOrders = editableOrders.filter(o => scopeOrderIds.has(o.id));
  const anyPublished = scopeOrders.some(isPublished);

  // ── row values ──
  const raw = (g: Bill2Group, f: Field) => edits[g.key]?.[f] ?? String((baselines.get(g.key) as RowBaseline)[f]);
  const num = (g: Bill2Group, f: Field) => { const x = parseFloat(raw(g, f)); return Number.isFinite(x) ? x : 0; };
  const def = (g: Bill2Group, f: "china" | "importFee") => { const b = baselines.get(g.key) as RowBaseline; return f === "china" ? b.defaultChina : b.defaultImport; };
  const isManual = (g: Bill2Group, f: "china" | "importFee") => raw(g, f) !== "" && Math.abs(num(g, f) - def(g, f)) > 0.004;

  const setField = (key: string, f: Field, v: string) => {
    setEdits(e => ({ ...e, [key]: { ...e[key], [f]: v } }));
    setInvalid(s => { if (!s.has(`${key}|${f}`)) return s; const n = new Set(s); n.delete(`${key}|${f}`); return n; });
  };
  const setParam = (changes: Record<string, string | null>) =>
    setParams(prev => { const n = new URLSearchParams(prev); for (const [k, v] of Object.entries(changes)) { if (v) n.set(k, v); else n.delete(k); } return n; }, { replace: true });
  const toggleSort = (key: SortKey) => setParam({ sort: `${key}:${sort.key === key && sort.dir === "asc" ? "desc" : "asc"}` });

  // ── summary ──
  const doneRows = groups.filter(g => num(g, "china") + num(g, "importFee") !== 0).length;
  const totalCI = groups.reduce((s, g) => s + num(g, "china") + num(g, "importFee"), 0);
  const shownChina = shown.reduce((s, g) => s + num(g, "china"), 0);
  const shownImport = shown.reduce((s, g) => s + num(g, "importFee"), 0);

  // ── actions ──
  const valuesFor = (strict: boolean) => {
    const m = new Map<string, { extraItems: number; extraShip: number; china: number; importFee: number }>();
    for (const g of groups) {
      const b = baselines.get(g.key) as RowBaseline;
      const n = (f: Field) => (!strict && raw(g, f) === "" ? b[f] : num(g, f));   // a draft keeps the saved number for a blanked cell
      m.set(g.key, { extraItems: n("extraItems"), extraShip: n("extraShip"), china: n("china"), importFee: n("importFee") });
    }
    return m;
  };
  const localValue = localShipping.trim() === "" ? undefined : parseFloat(localShipping) || 0;
  const patchesFor = (publish: boolean) => buildPatches({ groups, values: valuesFor(publish), orders: editableOrders, items, localShipping: localValue, publish });

  const askPublish = () => {
    const bad = new Set<string>();
    for (const g of groups) for (const f of ["china", "importFee"] as const) if (raw(g, f) === "") bad.add(`${g.key}|${f}`);
    if (bad.size > 0) {
      setInvalid(bad);
      setNotice(`กรอกค่าส่งจีนและค่านำเข้าให้ครบทุกแถวก่อนเผยแพร่ (ยังว่าง ${bad.size} ช่อง)`);
      requestAnimationFrame(() => document.querySelector('[data-invalid="true"]')?.scrollIntoView({ block: "center" }));
      return;
    }
    setNotice(null);
    setConfirm("publish");
  };

  const resetAll = () => {
    setEdits(e => {
      const n: Edits = { ...e };
      for (const g of groups) n[g.key] = { ...n[g.key], china: String(def(g, "china")), importFee: String(def(g, "importFee")) };
      return n;
    });
    setInvalid(new Set());
    setNotice(null);
    setConfirm(null);
  };

  const save = async (publish: boolean) => {
    setConfirm(null);
    setNotice(null);
    setSaving(true);
    const patches = patchesFor(publish);
    const batchId = generateBatchId();
    const failed: number[] = [];
    try {
      for (let i = 0; i < patches.length; i += 5) {   // 5 orders at a time — hundreds of parallel PATCHes are too hard on the host
        await Promise.all(patches.slice(i, i + 5).map(async p => {
          try {
            const r = await patchBill2(p.orderId, p.amount, p.status, undefined, p.unitPrices, batchId, p.china, p.importFee, p.localShipping, p.extraShipping);
            if (!r?.success) throw new Error("patch refused");
            if (p.moveToPendingPayment2) await patchOrderStatus(p.orderId, "wc-pending-payment-2");
          } catch { failed.push(p.orderId); }
        }));
      }
    } finally {
      setSaving(false);
    }
    const word = publish ? "เผยแพร่" : "บันทึกร่าง";
    if (failed.length === 0) {
      setEdits({});
      setLocalShipping("");
      setResult({ variant: "success", message: `${word}สำเร็จ ${patches.length} orders` });
    } else {
      const numbers = failed.map(id => `#${orders.find(o => o.id === id)?.number ?? id}`).join(", ");
      setResult({ variant: "error", message: `${word}สำเร็จ ${patches.length - failed.length}/${patches.length} orders — ไม่สำเร็จ: ${numbers} กดบันทึกซ้ำได้ (ค่าที่ส่งซ้ำได้ผลเท่าเดิม)` });
    }
    await load();
  };

  const confirmText = () => {
    const ps = patchesFor(true);
    const customers = new Set(scopeLines.map(l => l.customerId)).size;
    const total = ps.reduce((s, p) => s + p.amount, 0);
    return `จะเผยแพร่ Bill 2 ให้ลูกค้า ${customers} คน (${ps.length} orders) ยอด Bill 2 รวม ฿${fmt(total)} — ดำเนินการต่อ?`;
  };

  // ── render ──
  const sortMark = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? "↑" : "↓") : "↕");
  const th = "px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  const sortTh = (k: SortKey, text: string, cls = "") => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${th} ${cls}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase">{text} <span aria-hidden="true">{sortMark(k)}</span></button>
    </th>
  );

  return (
    <>
      <PageMeta title="Bill 2 Unit Prices | Jaonaichan Admin" description="Set China shipping / import fee per product code for Bill 2" />
      <PageBreadcrumb pageTitle="Bill 2 Unit Prices" />
      {saving && <PageSpinner />}

      <div className="space-y-6">
        {/* Toolbar */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <SearchSelect
              label="Category"
              value={category ? String(category.id) : ""}
              options={categories.map(c => ({ value: String(c.id), label: c.name, chip: `${c.productCount} สินค้า` }))}
              placeholder="เลือกหมวดสินค้า"
              onChange={v => setParam({ category: v || null, member: null })}
              disabled={loading || categories.length === 0}
            />
            <SearchSelect
              label="Member No"
              hint="กรองรายบุคคล"
              value={member ? String(member.id) : ""}
              options={members.map(m => ({ value: String(m.id), label: `${m.username || m.id} — ${m.name}`, sub: `${m.orderCount} orders` }))}
              allLabel="All Members"
              allChip={`${members.length} คน`}
              placeholder="All Members"
              onChange={v => setParam({ member: v || null })}
              disabled={!category}
              searchable
            />
            <div className="w-full sm:w-52">
              <label htmlFor="b2-local" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Local Shipping (per order)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">฿</span>
                <input
                  id="b2-local"
                  inputMode="decimal"
                  value={localShipping}
                  onChange={e => setLocalShipping(strip(e.target.value))}
                  placeholder="ใช้ค่าเดิม (ปล่อยว่าง)"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-8 pr-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90"
                />
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 md:ml-auto md:w-auto">
              <Button variant="outline" size="sm" className="min-w-32 flex-1 whitespace-nowrap md:flex-none" disabled={groups.length === 0} onClick={() => setConfirm("resetAll")}>↻ Reset ทั้งหน้า</Button>
              <span title={anyPublished ? "มีออเดอร์ที่เผยแพร่แล้ว บันทึกร่างไม่ได้ (ลูกค้าเห็นแล้ว)" : undefined} className="flex min-w-32 flex-1 md:flex-none">
                <Button variant="outline" size="sm" className="flex-1 whitespace-nowrap" disabled={groups.length === 0 || anyPublished} onClick={() => void save(false)}>บันทึกร่าง</Button>
              </span>
              <Button size="sm" className="min-w-32 flex-1 whitespace-nowrap md:flex-none" disabled={groups.length === 0} onClick={askPublish}>เผยแพร่ Bill 2</Button>
            </div>
          </div>
          {categoryFallback && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">ไม่พบหมวดที่ชื่อมีคำว่า "พรีออเดอร์" ในออเดอร์ที่รอตั้งราคา จึงแสดงทุกหมวดของสินค้า</p>
          )}
        </section>

        {notice && (
          <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">{notice}</div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon="📦" tone="bg-blue-50 dark:bg-blue-500/15" label="Orders ที่เกี่ยวข้อง">{scopeOrderIds.size} <span className="text-sm font-medium text-gray-500">bills</span></Stat>
          <Stat icon="🏷️" tone="bg-orange-50 dark:bg-orange-500/15" label="Product Codes">{new Set(groups.map(g => g.productCode)).size}</Stat>
          <Stat icon="✓" tone="bg-green-50 text-green-600 dark:bg-green-500/15" label="ราคาครบแล้ว">{doneRows} / {groups.length}</Stat>
          <Stat icon="฿" tone="bg-purple-50 text-purple-600 dark:bg-purple-500/15" label="รวม Bill 2 คำนวณ">฿ {fmt(totalCI)}</Stat>
        </div>

        {/* Table */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-800 dark:text-white/90">{category ? `Products ในหมวด: ${category.name}` : "Products"}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {member ? <>Member: <b>{member.username || member.id} — {member.name}</b></> : <>Member: <b>All Members</b></>} · Grouped by Product Code · ราคาต่างกันแยกเป็นแถว
              </p>
            </div>
            <input
              aria-label="ค้นหาสินค้า"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นชื่อ / รหัสสินค้า…"
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90 sm:w-72"
            />
          </div>

          {loading ? (
            <p className="px-4 pb-12 pt-6 text-center text-sm text-gray-400 sm:px-6">กำลังโหลดออเดอร์…</p>
          ) : loadError ? (
            <div className="px-4 pb-12 pt-6 text-center sm:px-6">
              <p className="mb-4 text-sm text-error-600">โหลดข้อมูลไม่สำเร็จ</p>
              <Button size="sm" onClick={() => void load()}>ลองใหม่</Button>
            </div>
          ) : !category ? (
            <p className="px-4 pb-12 pt-6 text-center text-sm text-gray-500 sm:px-6">
              {categories.length > 0
                ? "เลือกหมวดสินค้าเพื่อเริ่มหยอดราคา"
                : allLines.length > 0
                  ? "มีออเดอร์ที่รอตั้งราคา แต่ระบบไม่ส่งข้อมูลหมวดสินค้ามา (ธีมฝั่งเว็บอาจยังไม่ได้อัปเดต) — แจ้งผู้ดูแล"
                  : "ยังไม่มีออเดอร์ที่รอตั้งราคา Bill 2"}
            </p>
          ) : groups.length === 0 ? (
            <p className="px-4 pb-12 pt-6 text-center text-sm text-gray-500 sm:px-6">ยังไม่มีคำสั่งซื้อในหมวดนี้</p>
          ) : (
            <>
              <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-white/[0.05] sm:px-6">
                <b>{groups.length}</b> product codes · <b>{scopeOrderIds.size}</b> orders · Sort: <b>{sort.key === "product_code" ? "Product Code" : sort.key === "price" ? "ราคา" : "จำนวน"} {sort.dir === "asc" ? "↑" : "↓"}</b>
              </p>
              <div className="max-h-[70dvh] overflow-auto border-t border-gray-100 dark:border-white/[0.05]" data-testid="table-wrap">
                <table className="w-full min-w-2xl table-fixed border-collapse text-sm">
                  <colgroup><col className="w-[36%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[13%]" /><col className="w-[13%]" /></colgroup>
                  <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
                    <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                      {sortTh("product_code", "Product", "pl-4 sm:pl-6")}
                      {sortTh("price", "ราคา")}
                      {sortTh("qty", "จำนวน")}
                      <th scope="col" className={th}>Extra Items</th>
                      <th scope="col" className={th}>Extra Ship</th>
                      <th scope="col" className={th}>China Ship (Total)</th>
                      <th scope="col" className={`${th} pr-4`}>Import Fee (Total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">ไม่พบสินค้าที่ตรงกับคำค้น</td></tr>
                    )}
                    {shown.map(g => {
                      const b = baselines.get(g.key) as RowBaseline;
                      const money = (f: Field) => (
                        <MoneyInput
                          value={raw(g, f)}
                          onChange={v => setField(g.key, f, v)}
                          label={`${g.productCode} ${FIELD_LABEL[f]}`}
                          invalid={invalid.has(`${g.key}|${f}`)}
                        />
                      );
                      const total = (f: "china" | "importFee", pct: number, tdClass: string) => {
                        const manual = isManual(g, f);
                        const exact = Math.round(g.unitPrice * g.qty * pct) / 100;
                        const d = def(g, f);
                        const formula = `⌈${fmt(g.unitPrice)} × ${g.qty} × ${pct}%⌉ = ${d}`;
                        return (
                          <td className={tdClass}>
                            {money(f)}
                            <div className="mt-1 flex items-center gap-1">
                              {manual ? (
                                <>
                                  <span className="rounded bg-orange-50 px-1 text-theme-xs font-semibold uppercase text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">แก้เอง</span>
                                  <button
                                    type="button"
                                    aria-label={`รีเซ็ต ${g.productCode} ${FIELD_LABEL[f]} เป็นค่า default (${d})`}
                                    title={`Reset to default (${d})`}
                                    onClick={() => setField(g.key, f, String(d))}
                                    className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >↻</button>
                                </>
                              ) : (
                                <span title={formula} className="rounded bg-gray-100 px-1 text-theme-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  default{exact !== d && ` (⌈${exact}⌉=${d})`}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      };
                      return (
                        <tr key={g.key} data-row={g.key} className="border-b border-gray-100 hover:bg-gray-50/60 dark:border-white/[0.05] dark:hover:bg-white/[0.02]">
                          <td className="py-3 pl-4 pr-2 align-top sm:pl-6">
                            <div className="flex items-start gap-3">
                              {g.thumb
                                ? <img src={g.thumb} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg bg-gray-100 object-cover" />
                                : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800">🛍</div>}
                              <div className="min-w-0">
                                <span className="inline-block rounded bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">{g.productCode}</span>
                                <p className="truncate font-semibold text-gray-800 dark:text-white/90" title={g.productName}>{g.productName}</p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{variantText(g)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 align-top">
                            <p className="font-bold text-gray-800 dark:text-white/90">฿{fmt(g.unitPrice)}</p>
                            {g.isPriceSplit && <span className="mt-1 inline-block whitespace-nowrap rounded bg-orange-50 px-1 text-theme-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">แยกราคา</span>}
                          </td>
                          <td className="px-2 py-3 align-top">
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-green-50 px-2 font-bold text-green-700 dark:bg-green-500/15 dark:text-green-400">{g.qty}</span>
                          </td>
                          <td className="px-2 py-3 align-top">
                            {money("extraItems")}
                            {b.mixedExtra && <span title="ไลน์ในกลุ่มนี้เคยบันทึกค่า Extra ไม่เท่ากัน — บันทึกใหม่จะใช้ค่าที่เห็นกับทุกไลน์" className="mt-1 inline-block rounded bg-orange-50 px-1 text-theme-xs font-semibold text-orange-700">หลายค่า</span>}
                          </td>
                          <td className="px-2 py-3 align-top">{money("extraShip")}</td>
                          {total("china", CHINA_PCT, "px-2 py-3 align-top")}
                          {total("importFee", IMPORT_PCT, "py-3 pl-2 pr-4 align-top")}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 px-4 py-4 text-sm text-gray-500 dark:border-white/[0.05] sm:px-6">
                <span>Product codes ในหน้านี้: <b className="text-gray-800 dark:text-white/90">{new Set(shown.map(g => g.productCode)).size}</b></span>
                <span>รวม China Shipping: <b className="text-gray-800 dark:text-white/90">฿ {fmt(shownChina)}</b></span>
                <span>รวม Import Fee: <b className="text-gray-800 dark:text-white/90">฿ {fmt(shownImport)}</b></span>
              </div>
            </>
          )}
        </section>

        {/* Legend */}
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <span><b>default</b> = คำนวณโดยระบบ (⌈ราคา × จำนวน × {CHINA_PCT}% / {IMPORT_PCT}%⌉)</span>
          <span><b>แก้เอง</b> = ค่าที่ผู้ใช้พิมพ์เอง (ยกเลิกเห็นปุ่ม ↻)</span>
          <span><b>แยกราคา</b> = Product Code เดียวกันแต่หลายรสราคาต่างกัน</span>
          <span>Extra Items = ต่อชิ้น · Extra Ship = ต่อออเดอร์ · China / Import = ยอดรวมของแถว แบ่งตามจำนวนชิ้นให้ลูกค้าแต่ละคน</span>
        </p>
      </div>

      <AlertModal
        isOpen={confirm === "publish"}
        onClose={() => setConfirm(null)}
        variant="info"
        title="เผยแพร่ Bill 2"
        message={confirm === "publish" ? confirmText() : ""}
        onConfirm={() => void save(true)}
        confirmLabel="เผยแพร่"
        cancelLabel="ยกเลิก"
      />
      <AlertModal
        isOpen={confirm === "resetAll"}
        onClose={() => setConfirm(null)}
        variant="warning"
        title="Reset ทั้งหน้า"
        message="ค่า China Ship และ Import Fee ของทุกแถวในหมวด/สมาชิกที่เลือก จะกลับเป็นค่า default ที่ระบบคำนวณ (ค่าที่ยังไม่ได้บันทึกจะหายไป) — ดำเนินการต่อ?"
        onConfirm={resetAll}
        confirmLabel="Reset"
        cancelLabel="ยกเลิก"
      />
      <AlertModal
        isOpen={result !== null}
        onClose={() => setResult(null)}
        variant={result?.variant ?? "success"}
        message={result?.message ?? ""}
      />
    </>
  );
}
