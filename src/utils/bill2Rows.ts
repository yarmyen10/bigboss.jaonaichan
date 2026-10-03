// Pure logic for the Bill 2 Unit Prices page (spec: Trello "Bill 2 Unit Prices > New Mock"). No React here so e2e/bill2-logic.test.js can run it in node.
import type { Order, OrderProductsBulkItem } from '../interfaces/order.jaonaichan';

export const CHINA_PCT = 10;
export const IMPORT_PCT = 20;

// same rule as useManageProducts.roundUp (round up to 0.5 baht) — duplicated so this file stays free of React imports
export const roundUp = (n: number) => Math.ceil(n * 2) / 2;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** ⌈price × qty × pct%⌉ in integer maths — in floats 30 × 8 × 0.10 = 24.000000000000004 would round up to 25 */
export function ceilPct(unitPrice: number, qty: number, pct: number): number {
    const num = Math.round(unitPrice * 100) * qty * pct;   // satang × pieces × percent
    return Math.floor((num + 9999) / 10000);
}

// ─── lines → rows ────────────────────────────────────────────────────────────

/** one order line item (item_id) that is in scope, with what is already saved on its order */
export interface Bill2Line {
    itemId: number;
    orderId: number;
    customerId: number;
    customerName: string;
    customerUsername: string;
    qty: number;
    productCode: string;
    parentId: number;
    productName: string;
    thumb: string | null;
    unitPrice: number;   // list price per piece when it was ordered
    flavor: string;
    categoryIds: number[];
    categoryNames: Record<number, string>;
    categoryParents: Record<number, string>;
    /** undefined = nothing saved for this line yet */
    saved: { extraItems?: number; extraShip?: number; china?: number; importFee?: number };
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

export function toLines(items: OrderProductsBulkItem[], orders: Order[]): Bill2Line[] {
    const byId = new Map(orders.map(o => [o.id, o]));
    const lines: Bill2Line[] = [];
    for (const it of items) {
        const o = byId.get(it.id);
        if (!o) continue;
        const p = it.product;
        const terms = p.category_terms ?? [];
        const parentId = p.parent_id ?? p.id;
        const b = o.bill2;
        lines.push({
            itemId: it.item_id,
            orderId: o.id,
            customerId: o.customer.id,
            customerName: o.customer.name,
            customerUsername: o.customer.username ?? '',
            qty: it.quantity,
            productCode: p.sku || `ID-${parentId}`,
            parentId,
            productName: p.parent_name ?? p.name,
            thumb: p.image?.thumbnail ?? p.image?.medium ?? null,
            unitPrice: it.quantity > 0 ? round2(it.subtotal / it.quantity) : 0,
            flavor: (it.variation ?? []).map(v => stripTags(v.value)).filter(Boolean).join(' / '),
            categoryIds: terms.map(t => t.id),
            categoryNames: Object.fromEntries(terms.map(t => [t.id, t.name])),
            categoryParents: Object.fromEntries(terms.map(t => [t.id, t.parent_name])),
            saved: {
                extraItems: b.unit_prices?.[it.item_id],
                extraShip: b.extra_shipping_by_product?.[it.item_id],
                china: b.china_shipping_by_product?.[it.item_id],
                importFee: b.import_fee_by_product?.[it.item_id],
            },
        });
    }
    return lines;
}

/** an order whose Bill 2 the customer has already submitted/paid is frozen — it must never be re-priced from this page */
export const isEditable = (o: Order) => o.bill2.status === 'draft' || o.bill2.status === 'pending';
/** published = customers can see it (batch id set and not a draft) */
export const isPublished = (o: Order) => !!o.bill2.unit_prices_id && o.bill2.status !== 'draft';

export interface Bill2Group {
    key: string;                 // `${productCode}::${unitPrice}`
    productCode: string;
    productName: string;
    thumb: string | null;
    unitPrice: number;
    qty: number;
    lines: Bill2Line[];
    orderIds: number[];
    flavors: string[];
    isPriceSplit: boolean;       // this product code has more than one price
}

export function groupLines(lines: Bill2Line[]): Bill2Group[] {
    const map = new Map<string, Bill2Group>();
    for (const l of lines) {
        const key = `${l.productCode}::${l.unitPrice}`;
        let g = map.get(key);
        if (!g) {
            g = { key, productCode: l.productCode, productName: l.productName, thumb: l.thumb, unitPrice: l.unitPrice, qty: 0, lines: [], orderIds: [], flavors: [], isPriceSplit: false };
            map.set(key, g);
        }
        g.qty += l.qty;
        g.lines.push(l);
        if (!g.orderIds.includes(l.orderId)) g.orderIds.push(l.orderId);
        if (l.flavor && !g.flavors.includes(l.flavor)) g.flavors.push(l.flavor);
    }
    const perCode = new Map<string, number>();
    for (const g of map.values()) perCode.set(g.productCode, (perCode.get(g.productCode) ?? 0) + 1);
    for (const g of map.values()) g.isPriceSplit = (perCode.get(g.productCode) ?? 0) > 1;
    return [...map.values()];
}

export type SortKey = 'product_code' | 'price' | 'qty';
export type SortSpec = { key: SortKey; dir: 'asc' | 'desc' };

export function parseSort(raw: string | null): SortSpec {
    const [k, d] = (raw ?? '').split(':');
    const key: SortKey = k === 'price' || k === 'qty' ? k : 'product_code';
    return { key, dir: d === 'desc' ? 'desc' : 'asc' };
}

export function sortGroups(groups: Bill2Group[], s: SortSpec): Bill2Group[] {
    const dir = s.dir === 'asc' ? 1 : -1;
    const code = (a: Bill2Group, b: Bill2Group) => a.productCode.localeCompare(b.productCode, 'th', { numeric: true }) || a.unitPrice - b.unitPrice;
    return [...groups].sort((a, b) => {
        if (s.key === 'price') return (a.unitPrice - b.unitPrice) * dir || code(a, b);
        if (s.key === 'qty') return (a.qty - b.qty) * dir || code(a, b);
        return code(a, b) * dir;
    });
}

// ─── row values ──────────────────────────────────────────────────────────────

export interface RowBaseline {
    extraItems: number;
    extraShip: number;
    china: number;
    importFee: number;
    defaultChina: number;
    defaultImport: number;
    /** legacy lines of the group hold different Extra values — the row shows the most common one */
    mixedExtra: boolean;
}

const mode = (xs: number[]) => {
    const n = new Map<number, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
};

/** what the row shows before the admin types anything: the saved numbers, else the formula default for China/Import */
export function baselineOf(g: Bill2Group): RowBaseline {
    const defaultChina = ceilPct(g.unitPrice, g.qty, CHINA_PCT);
    const defaultImport = ceilPct(g.unitPrice, g.qty, IMPORT_PCT);
    const savedTotal = (pick: (l: Bill2Line) => number | undefined) =>
        g.lines.some(l => pick(l) !== undefined) ? round2(g.lines.reduce((s, l) => s + (pick(l) ?? 0), 0)) : undefined;
    const extraItemsVals = g.lines.map(l => l.saved.extraItems ?? 0);
    const extraShipVals = g.lines.map(l => l.saved.extraShip ?? 0);
    return {
        extraItems: mode(extraItemsVals),
        extraShip: mode(extraShipVals),
        china: savedTotal(l => l.saved.china) ?? defaultChina,
        importFee: savedTotal(l => l.saved.importFee) ?? defaultImport,
        defaultChina,
        defaultImport,
        mixedExtra: new Set(extraItemsVals).size > 1 || new Set(extraShipVals).size > 1,
    };
}

/** split a typed total over lines by qty so the parts add up to EXACTLY the total (whole baht when the total is whole, else satang) */
export function allocate(total: number, lines: { key: number; qty: number }[]): Map<number, number> {
    const out = new Map<number, number>();
    const Q = lines.reduce((s, l) => s + l.qty, 0);
    if (!(total > 0) || Q <= 0) { for (const l of lines) out.set(l.key, 0); return out; }
    const unit = Number.isInteger(total) ? 1 : 0.01;
    const T = Math.round(total / unit);
    const parts = lines.map((l, i) => ({ l, i, base: Math.floor((T * l.qty) / Q), rem: (T * l.qty) % Q }));
    let left = T - parts.reduce((s, p) => s + p.base, 0);
    for (const p of [...parts].sort((a, b) => b.rem - a.rem || a.i - b.i)) {
        if (left <= 0) break;
        p.base++; left--;
    }
    for (const p of parts) out.set(p.l.key, round2(p.base * unit));
    return out;
}

// ─── save ────────────────────────────────────────────────────────────────────

export interface GroupValues { extraItems: number; extraShip: number; china: number; importFee: number }

export interface OrderPatch {
    orderId: number;
    amount: number;
    status: 'draft' | 'pending';
    unitPrices: Record<number, number>;
    china: Record<number, number>;
    importFee: Record<number, number>;
    extraShipping: Record<number, number>;
    localShipping?: number;
    moveToPendingPayment2: boolean;
}

// the PATCH replaces each whole map, so start from what the order already holds (only numeric item ids — drops the legacy flat entry)
const numericMap = (m?: Record<number, number>): Record<number, number> =>
    Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => /^\d+$/.test(k)).map(([k, v]) => [Number(k), Number(v)]));

/** one patch per order that has a line in `groups`; lines of the order outside the groups keep what they had */
export function buildPatches(p: {
    groups: Bill2Group[];
    values: Map<string, GroupValues>;
    orders: Order[];
    items: OrderProductsBulkItem[];
    localShipping?: number;
    publish: boolean;
}): OrderPatch[] {
    const perLine = new Map<number, GroupValues>();
    for (const g of p.groups) {
        const v = p.values.get(g.key);
        if (!v) continue;
        const keyed = g.lines.map(l => ({ key: l.itemId, qty: l.qty }));
        const china = allocate(v.china, keyed);
        const imp = allocate(v.importFee, keyed);
        for (const l of g.lines) perLine.set(l.itemId, { extraItems: v.extraItems, extraShip: v.extraShip, china: china.get(l.itemId) ?? 0, importFee: imp.get(l.itemId) ?? 0 });
    }
    const orderIds = [...new Set(p.groups.flatMap(g => g.orderIds))];
    const byId = new Map(p.orders.map(o => [o.id, o]));
    const patches: OrderPatch[] = [];
    for (const id of orderIds) {
        const o = byId.get(id);
        if (!o) continue;
        const items = p.items.filter(i => i.id === id);
        const unitPrices = numericMap(o.bill2.unit_prices);
        const china = numericMap(o.bill2.china_shipping_by_product);
        const importFee = numericMap(o.bill2.import_fee_by_product);
        const extraShipping = numericMap(o.bill2.extra_shipping_by_product);
        for (const it of items) {
            const v = perLine.get(it.item_id);
            if (!v) continue;
            if (v.extraItems > 0) unitPrices[it.item_id] = v.extraItems; else delete unitPrices[it.item_id];
            if (v.extraShip > 0) extraShipping[it.item_id] = v.extraShip; else delete extraShipping[it.item_id];
            china[it.item_id] = v.china;          // explicit 0 is kept, so "priced at 0" survives a reload
            importFee[it.item_id] = v.importFee;
        }
        const sum = (m: Record<number, number>) => items.reduce((s, it) => s + (m[it.item_id] ?? 0), 0);
        const goods = items.reduce((s, it) => s + roundUp((unitPrices[it.item_id] ?? 0) * it.quantity), 0);
        const local = p.localShipping ?? o.bill2.local_shipping ?? 0;
        patches.push({
            orderId: id,
            amount: roundUp(goods + sum(china) + sum(importFee) + sum(extraShipping) + local),
            status: p.publish ? 'pending' : 'draft',
            unitPrices, china, importFee, extraShipping,
            ...(p.localShipping !== undefined && { localShipping: p.localShipping }),
            moveToPendingPayment2: o.status === 'paid-1',
        });
    }
    return patches;
}

// ─── filters ─────────────────────────────────────────────────────────────────

/** a pre-order round is a category named like "สินค้าพรีออเดอร์รอบ 21" (on this shop they are top-level), or a child of a "พรีออเดอร์" / "Pre-order" category.
 *  "Ready to ship …" and ordinary categories are not rounds. */
export const PREORDER_NAME = /พรีออเดอร์|pre-?order/i;

export interface CategoryOption { id: number; name: string; productCount: number }

export function categoryOptions(lines: Bill2Line[]): { options: CategoryOption[]; fallback: boolean } {
    const all = new Map<number, { name: string; parent: string; products: Set<number> }>();
    for (const l of lines) for (const id of l.categoryIds) {
        let c = all.get(id);
        if (!c) { c = { name: l.categoryNames[id], parent: l.categoryParents[id] ?? '', products: new Set() }; all.set(id, c); }
        c.products.add(l.parentId);
    }
    let picked = [...all.entries()].filter(([, c]) => PREORDER_NAME.test(c.name) || PREORDER_NAME.test(c.parent));
    const fallback = picked.length === 0 && all.size > 0;
    if (fallback) picked = [...all.entries()];   // nothing looks like a pre-order round: show every category rather than an empty page
    const options = picked
        .map(([id, c]) => ({ id, name: c.name, productCount: c.products.size }))
        .sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }));
    return { options, fallback };
}

export interface MemberOption { id: number; name: string; username: string; orderCount: number }

export function memberOptions(lines: Bill2Line[]): MemberOption[] {
    const m = new Map<number, MemberOption & { orders: Set<number> }>();
    for (const l of lines) {
        let x = m.get(l.customerId);
        if (!x) { x = { id: l.customerId, name: l.customerName, username: l.customerUsername, orderCount: 0, orders: new Set() }; m.set(l.customerId, x); }
        x.orders.add(l.orderId);
    }
    return [...m.values()]
        .map(x => ({ id: x.id, name: x.name, username: x.username, orderCount: x.orders.size }))
        .sort((a, b) => (a.username || String(a.id)).localeCompare(b.username || String(b.id), 'th', { numeric: true }));
}
