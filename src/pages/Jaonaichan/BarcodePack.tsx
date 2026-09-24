import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '../../components/ui/button/Button';
import Badge from '../../components/ui/badge/Badge';
import DatePicker from '../../components/form/date-picker';
import { Modal } from '../../components/ui/modal';
import { CatShopping } from '../../icons';
import BasicTableOne, { BasicTableColumn } from '../../components/tables/BasicTables/BasicTableOne';
import OrderDetails from '../../components/jaonaichan/OrderDetails';
import {
    getBarcodeOrderItems,
    validateBarcode,
    confirmPack,
    saveTracking,
    getOrders,
    getOrder,
    getLots,
    createLot,
} from '../../services/jaonaichan';
import type { BarcodeOrderItem, TrackingParcel } from '../../interfaces/barcode.jaonaichan';
import type { Lot } from '../../interfaces/lot.jaonaichan';
import type { Order } from '../../interfaces/order.jaonaichan';

interface EnhancedBarcodeOrderItem extends BarcodeOrderItem {
    sku?: string;
    image?: string | null;
}

const SCANNER_ELEMENT_ID = 'barcode-pack-reader';
const PACKED_STATUSES = new Set(['packed', 'wait-tracking', 'tracked', 'wait-shipping', 'shipped']);
// Statuses that belong in the pack queue
const QUEUE_STATUSES = 'paid-1,paid-2,packed,wait-tracking';
const isQueueable = (o: { status: string; is_rts?: boolean }) =>
    o.status === 'paid-2' ||
    (o.status === 'paid-1' && !!o.is_rts) ||
    o.status === 'packed' ||
    o.status === 'wait-tracking';

const CARRIERS: { value: TrackingParcel['carrier']; label: string; short: string; bg: string; text: string; ring: string }[] = [
    { value: 'kerry',    label: 'Kerry Express',  short: 'KEX',   bg: 'bg-[#E30013]', text: 'text-white', ring: 'ring-[#E30013]' },
    { value: 'flash',    label: 'Flash Express',  short: 'FLASH', bg: 'bg-[#FF6B00]', text: 'text-white', ring: 'ring-[#FF6B00]' },
    { value: 'jt',       label: 'J&T Express',    short: 'J&T',   bg: 'bg-[#E8000D]', text: 'text-white', ring: 'ring-[#E8000D]' },
    { value: 'thaipost', label: 'ไปรษณีย์ไทย',   short: 'POST',  bg: 'bg-[#6B2D8B]', text: 'text-white', ring: 'ring-[#6B2D8B]' },
    { value: 'spx',      label: 'Shopee Express', short: 'SPX',   bg: 'bg-[#EE4D2D]', text: 'text-white', ring: 'ring-[#EE4D2D]' },
];

const trackingUrl = (carrier: string, number: string): string | null => {
    const n = encodeURIComponent(number.trim());
    const map: Record<string, string> = {
        kerry:    `https://th.kex-express.com/en/track/?track=${n}`,
        flash:    `https://flashexpress.com/tracking/?se=${n}`,
        jt:       `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${n}`,
        thaipost: `https://track.thailandpost.co.th/?trackNumber=${n}`,
        spx:      `https://spx.co.th/track?${n}`,
    };
    return map[carrier] ?? null;
};

function getOrderPaidAt(order: Order): Date | null {
    const str = order.is_rts ? order.bill1?.paid_at : order.bill2?.paid_at;
    return str ? new Date(str) : null;
}

function isOverdue(order: Order): boolean {
    const paidAt = getOrderPaidAt(order);
    return paidAt ? Date.now() - paidAt.getTime() > 24 * 60 * 60 * 1000 : false;
}

function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Short Buddhist-era display for the pack-date filter, e.g. "16 Sep 69" — visual only,
// the actual query value stays ISO (see DatePicker's displayFormat prop).
function formatShortBuddhist(d: Date): string {
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const beYear = (d.getFullYear() + 543) % 100;
    return `${day} ${month} ${String(beYear).padStart(2, '0')}`;
}

interface ScanResult { ok: boolean; name?: string; }

// ── Small components ──────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${color}`}>{icon}</div>
            <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
                <p className="text-lg font-extrabold leading-none text-gray-800 dark:text-white/90">{value}</p>
            </div>
        </div>
    );
}

const STATUS_BADGE: Record<string, { color: 'success' | 'warning' | 'primary' | 'light'; label: string }> = {
    'paid-1':       { color: 'success', label: 'RTS Paid' },
    'paid-2':       { color: 'success', label: 'Paid' },
    'packed':       { color: 'primary', label: '✓ Packed' },
    'wait-tracking':{ color: 'warning', label: 'รอ Tracking' },
};

function QueueItem({ order, selected, onClick }: { order: Order; selected: boolean; onClick: () => void }) {
    const initial = (order.customer.name ?? '?')[0]?.toUpperCase() ?? '?';
    const paidAt = getOrderPaidAt(order);
    const overdue = isOverdue(order);
    const badge = STATUS_BADGE[order.status] ?? { color: 'light' as const, label: order.status };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                selected
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20'
                    : overdue
                    ? 'border-error-200 bg-error-50/50 hover:bg-error-50 dark:border-error-500/30 dark:bg-error-500/5 dark:hover:bg-error-500/10'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${selected ? 'bg-brand-500' : 'bg-gray-400 dark:bg-gray-600'}`}>
                        {initial}
                    </div>
                    <span className={`text-sm font-bold ${selected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-800 dark:text-white/90'}`}>
                        #{order.id}
                    </span>
                    {overdue && <Badge color="error" size="sm">🔥 ค้างนาน</Badge>}
                </div>
                <Badge color={badge.color} size="sm">{badge.label}</Badge>
            </div>
            <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">{order.customer.name}</p>
            <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                <span>{order.customer.username}</span>
                {paidAt && <span>{paidAt.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
        </button>
    );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">{children}</span>
        </div>
    );
}

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 min-w-0 overflow-hidden bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</p>
                {action}
            </div>
            {children}
        </div>
    );
}

const ITEM_COLUMNS: BasicTableColumn[] = [
    { key: "no",     label: "No.",      className: "text-center w-10" },
    { key: "photo",  label: "Photo",    className: "text-center w-14" },
    { key: "code",   label: "Code" },
    { key: "name",   label: "Item Name", className: "min-w-[160px]" },
    { key: "qty",    label: "Qty",      className: "text-center w-20" },
    { key: "action", label: "Action",   className: "text-center w-20 hidden xl:table-cell" },
];

export default function BarcodePack() {
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [queueFilter, setQueueFilter] = useState<'all' | 'overdue'>('all');
    const [queueSearch, setQueueSearch] = useState('');
    const [sortBy, setSortBy] = useState<'paid_asc' | 'paid_desc' | 'order_id'>('paid_asc');

    const [lots, setLots] = useState<Lot[]>([]);
    const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
    const [creatingLot, setCreatingLot] = useState(false);

    const [items, setItems] = useState<EnhancedBarcodeOrderItem[]>([]);
    const [scanned, setScanned] = useState<Record<number, string[]>>({});
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemsError, setItemsError] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [validating, setValidating] = useState(false);
    const [toast, setToast] = useState('');
    const [lastPackedOrderId, setLastPackedOrderId] = useState<number | null>(null);
    const [parcels, setParcels] = useState<TrackingParcel[]>([{ carrier: 'kerry', number: '' }]);
    const [savingTracking, setSavingTracking] = useState(false);
    const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [manualBarcode, setManualBarcode] = useState('');
    const [inlineBarcode, setInlineBarcode] = useState('');
    const [cameraFailed, setCameraFailed] = useState(false);

    const manualInputRef = useRef<HTMLInputElement>(null);
    const inlineScanRef = useRef<HTMLInputElement>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const itemsRef = useRef<EnhancedBarcodeOrderItem[]>([]);
    const scannedRef = useRef<Record<number, string[]>>({});
    const filteredOrdersRef = useRef<Order[]>([]);
    const selectedOrderRef = useRef<Order | null>(null);
    const loadReqRef = useRef(0);

    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => { scannedRef.current = scanned; }, [scanned]);
    useEffect(() => { getLots().then(setLots).catch(() => {}); }, []);
    useEffect(() => {
        const id = Number(searchParams.get('orderId'));
        if (id) setSearchParams(p => { p.delete('orderId'); return p; }, { replace: true });
        void handleLoadOrders(undefined, id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const handleBarcodeInput = useCallback(async (barcode: string) => {
        setCameraOpen(false);
        setManualBarcode('');
        setInlineBarcode('');
        setValidating(true);
        try {
            const res = await validateBarcode(barcode);
            const matched = itemsRef.current.find(i => i.product_id === res.product_id);
            if (!matched) {
                setScanResult({ ok: false, name: `Product ID ${res.product_id} not in this order` });
                return;
            }
            const scannedCount = scannedRef.current[res.product_id]?.length ?? 0;
            if (scannedCount >= matched.qty) {
                setScanResult({ ok: false, name: `${res.product_name} scanned enough already (${matched.qty}/${matched.qty})` });
                return;
            }
            setScanned(prev => ({ ...prev, [res.product_id]: [...(prev[res.product_id] ?? []), barcode] }));
            setScanResult({ ok: true, name: res.product_name });
        } catch {
            setScanResult({ ok: false });
        } finally {
            setValidating(false);
        }
    }, []);

    useEffect(() => { if (cameraFailed) manualInputRef.current?.focus(); }, [cameraFailed]);

    useEffect(() => {
        if (!cameraOpen) return;
        setCameraFailed(false);
        let stopped = false;
        const timer = setTimeout(async () => {
            try {
                const el = document.getElementById(SCANNER_ELEMENT_ID);
                if (!el) { setToast('Scanner element not ready.'); setCameraOpen(false); return; }
                const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
                const onScan = async (barcode: string) => {
                    if (stopped) return;
                    stopped = true;
                    try { await scanner.stop(); } catch { /* ok */ }
                    scannerRef.current = null;
                    handleBarcodeInput(barcode);
                };
                try {
                    await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 150 } }, onScan, () => {});
                } catch {
                    await scanner.start({ facingMode: 'user' }, { fps: 10, qrbox: { width: 280, height: 150 } }, onScan, () => {});
                }
                scannerRef.current = scanner;
            } catch {
                scannerRef.current = null;
                setCameraFailed(true);
            }
        }, 150);
        return () => {
            clearTimeout(timer);
            if (scannerRef.current && !stopped) {
                stopped = true;
                try { scannerRef.current.stop().catch(() => {}); } catch { /* ok */ }
                scannerRef.current = null;
            }
        };
    }, [cameraOpen]);

    const loadItemsForOrderId = async (id: number, hint?: Order) => {
        const reqId = ++loadReqRef.current;
        setLoadingItems(true);
        setItemsError('');
        setItems([]);
        setScanned({});
        setScanResult(null);
        setLastPackedOrderId(null);
        try {
            const [res, detail] = await Promise.all([
                getBarcodeOrderItems(id),
                getOrder(id).catch(() => null),
            ]);
            if (reqId !== loadReqRef.current) return; // stale — newer call already in flight
            const order = detail ?? hint ?? null;
            setSelectedOrder(order);

            const isPackable = order && (
                order.status === 'paid-2' ||
                (order.status === 'paid-1' && order.is_rts) ||
                PACKED_STATUSES.has(order.status)
            );
            if (!isPackable) {
                setItemsError(`Order #${id} status "${order?.status ?? '?'}" — ไม่อยู่ในเงื่อนไขการแพ็ค`);
                return;
            }
            if (res.items.length === 0) {
                setItemsError('No items found for this order.');
            } else {
                setItems(res.items.map(item => {
                    const m = order?.items?.find(oi => oi.item_id === item.order_item_id);
                    return { ...item, sku: m?.product?.sku, image: m?.product?.image?.thumbnail };
                }));
            }
            if (order && PACKED_STATUSES.has(order.status)) {
                setLastPackedOrderId(order.id);
                setParcels([{ carrier: 'kerry', number: '' }]);
                if (order.lot_id) setSelectedLotId(order.lot_id);
            }
        } catch {
            if (reqId !== loadReqRef.current) return;
            setItemsError('Failed to load order items.');
        } finally {
            if (reqId === loadReqRef.current) setLoadingItems(false);
        }
    };

    // date = undefined/null → no date filter; 'YYYY-MM-DD' → filter by creation date
    // preferredOrderId → auto-select this order instead of sorted[0] (used for ?orderId= URL param)
    const handleLoadOrders = async (date?: string | null, preferredOrderId?: number | null) => {
        setSelectedOrder(null);
        setItems([]);
        setScanned({});
        setScanResult(null);
        setItemsError('');
        setLastPackedOrderId(null);
        setLoadingOrders(true);
        try {
            const dateParam: Record<string, string> = {};
            if (date) {
                const [y, m, day] = date.split('-');
                dateParam.createDate = `${day}/${m}/${y}`;
            }
            // Two parallel fetches so paid-1 RTS orders don't consume slots from the 50-cap shared with paid-2/packed/wait-tracking
            const [mainRes, rtsRes] = await Promise.all([
                getOrders({ ...dateParam, status: 'paid-2,packed,wait-tracking', perPage: 50 }),
                getOrders({ ...dateParam, status: 'paid-1', perPage: 50 }),
            ]);
            const seen = new Set<number>();
            const combined: Order[] = [];
            for (const o of [...mainRes.data, ...rtsRes.data]) {
                if (!seen.has(o.id) && isQueueable(o)) { seen.add(o.id); combined.push(o); }
            }
            combined.sort((a, b) => {
                const t = (o: typeof a) => getOrderPaidAt(o)?.getTime() ?? 0;
                return t(a) - t(b);
            });
            setOrders(combined);
            const first = (preferredOrderId && combined.find(o => o.id === preferredOrderId)) ?? (combined.length > 0 ? combined[0] : null);
            if (first) void loadItemsForOrderId(first.id, first);
        } catch (err: any) {
            setToast('Failed to load orders: ' + err.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleQueueSearch = async () => {
        const val = queueSearch.trim();
        if (!val) return;
        // Long numeric = order ID, load directly
        if (/^\d{5,}$/.test(val)) {
            setOrders([]);
            void loadItemsForOrderId(Number(val));
            return;
        }
        setOrders([]);
        setSelectedOrder(null);
        setItems([]);
        setScanned({});
        setScanResult(null);
        setItemsError('');
        setLastPackedOrderId(null);
        setLoadingOrders(true);
        try {
            const isNum = /^\d+$/.test(val);
            const res = await getOrders({
                status: QUEUE_STATUSES, perPage: 50,
                ...(isNum ? { memberNo: Number(val) } : { username: val }),
            });
            const sorted = res.data
                .filter(isQueueable)
                .sort((a, b) => (getOrderPaidAt(a)?.getTime() ?? 0) - (getOrderPaidAt(b)?.getTime() ?? 0));
            setOrders(sorted);
            if (sorted.length > 0) void loadItemsForOrderId(sorted[0].id, sorted[0]);
        } catch (err) {
            setToast('Search failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleSelectOrder = (order: Order) => {
        setSelectedOrder(order);
        void loadItemsForOrderId(order.id, order);
    };

    const handleCreateLot = async () => {
        setCreatingLot(true);
        try {
            const lot = await createLot();
            setLots(prev => [lot, ...prev]);
            setSelectedLotId(lot.id);
        } catch {
            setToast('Failed to create lot.');
        } finally {
            setCreatingLot(false);
        }
    };

    const handleConfirmPack = async () => {
        if (!selectedOrder) return;
        setConfirming(true);
        try {
            const packedId = selectedOrder.id;
            await confirmPack(packedId, scanned, selectedLotId ?? undefined);
            setLastPackedOrderId(packedId);
            setParcels([{ carrier: 'kerry', number: '' }]);
            setItems([]);
            setScanned({});
            setScanResult(null);
            const idx = orders.findIndex(o => o.id === packedId);
            const nextOrders = orders.filter(o => o.id !== packedId);
            setOrders(nextOrders);
            if (nextOrders.length > 0) {
                void loadItemsForOrderId(nextOrders[Math.min(idx, nextOrders.length - 1)].id, nextOrders[Math.min(idx, nextOrders.length - 1)]);
            } else {
                setSelectedOrder(null);
            }
        } catch {
            setToast('Failed to confirm pack.');
        } finally {
            setConfirming(false);
        }
    };

    const handleSaveTracking = async () => {
        if (!lastPackedOrderId) return;
        const valid = parcels.filter(p => p.number.trim());
        if (!valid.length) return;
        setSavingTracking(true);
        try {
            await saveTracking(lastPackedOrderId, valid);
            setToast(`Order #${lastPackedOrderId} — tracking saved`);
            setLastPackedOrderId(null);
        } catch {
            setToast('Failed to save tracking.');
        } finally {
            setSavingTracking(false);
        }
    };

    // Keyboard ↑↓ to navigate queue
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const list = filteredOrdersRef.current;
            if (!list.length) return;
            const idx = list.findIndex(o => o.id === selectedOrderRef.current?.id);
            const next = e.key === 'ArrowDown'
                ? list[Math.min(idx + 1, list.length - 1)]
                : list[Math.max(idx - 1, 0)];
            if (next && next.id !== selectedOrderRef.current?.id) void loadItemsForOrderId(next.id, next);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allScanned = items.length > 0 && items.every(item => (scanned[item.product_id]?.length ?? 0) >= item.qty);
    const isHttps = window.location.protocol === 'https:';
    const overdueCount = orders.filter(isOverdue).length;

    const sortedOrders = [...orders].sort((a, b) => {
        if (sortBy === 'order_id') return b.id - a.id;
        const ta = getOrderPaidAt(a)?.getTime() ?? 0;
        const tb = getOrderPaidAt(b)?.getTime() ?? 0;
        return sortBy === 'paid_asc' ? ta - tb : tb - ta;
    });
    const filteredOrders = queueFilter === 'overdue' ? sortedOrders.filter(isOverdue) : sortedOrders;
    filteredOrdersRef.current = filteredOrders;
    selectedOrderRef.current = selectedOrder;

    const tableRows = items.map((item, index) => {
        const scannedCount = scanned[item.product_id]?.length ?? 0;
        const isPacked = !!selectedOrder && PACKED_STATUSES.has(selectedOrder.status);
        const done = isPacked || scannedCount >= item.qty;
        return {
            no:     <div className="text-center">{index + 1}</div>,
            photo:  item.image
                ? <img src={item.image} alt="" className="mx-auto h-9 w-9 rounded object-cover bg-gray-100 dark:bg-gray-800" />
                : <div className="mx-auto flex h-9 w-9 items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-800">-</div>,
            code:   <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{item.sku || '-'}</span>,
            name:   <p className="text-sm text-gray-800 dark:text-white/90 line-clamp-2">{item.name}</p>,
            qty:    <div className="text-center"><Badge color={done ? 'primary' : 'light'} size="sm">{isPacked ? item.qty : scannedCount}/{item.qty}</Badge></div>,
            action: (
                <div className="text-center">
                    {isPacked
                        ? <Badge color="primary" size="sm">✓</Badge>
                        : <Button size="sm" disabled={done || cameraOpen} onClick={() => { setScanResult(null); setCameraOpen(true); }}>Scan</Button>
                    }
                </div>
            ),
        };
    });

    const isPacked = !!selectedOrder && PACKED_STATUSES.has(selectedOrder.status);

    const mobileShowDetail = !!selectedOrder || loadingItems || !!itemsError;

    return (
        <div className="flex flex-col gap-3" style={{ height: 'calc(100dvh - 72px)' }}>

            {/* ── Row 1: Title + stats ── */}
            <div className="flex shrink-0 items-start justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Pack Order</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">คิวออเดอร์ที่รอแพ็ค · เรียงตามเวลาชำระเงิน (เก่าสุดก่อน)</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden items-center gap-2 sm:flex">
                        <StatPill icon="📦" label="ทั้งหมด" value={orders.length} color="bg-brand-50 dark:bg-brand-500/10" />
                        <StatPill icon="⏳" label="รอแพ็ค"  value={orders.filter(o => !PACKED_STATUSES.has(o.status)).length} color="bg-warning-50 dark:bg-warning-500/10" />
                        {overdueCount > 0 && <StatPill icon="🔥" label="เร้งด่วน" value={overdueCount} color="bg-error-50 dark:bg-error-500/10" />}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsHelpOpen(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-400 transition"
                        title="คู่มือการใช้งาน"
                    >?</button>
                </div>
            </div>

            {!isHttps && (
                <div className="shrink-0 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
                    Camera requires HTTPS. Barcode scanning may not work.
                </div>
            )}
            {toast && (
                <div className="shrink-0 rounded-lg border border-success-300 bg-success-50 px-3 py-2 text-xs font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                    {toast}
                </div>
            )}

            {/* ── Toolbar row — visible only when orders are loaded ── */}
            {orders.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Search */}
                    <form onSubmit={e => { e.preventDefault(); void handleQueueSearch(); }} className="flex min-w-[180px] flex-1 gap-2 sm:max-w-xs">
                        <div className="relative flex-1">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input
                                type="text"
                                value={queueSearch}
                                onChange={e => setQueueSearch(e.target.value)}
                                placeholder="ค้นหา Order ID, Member…"
                                className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                            />
                        </div>
                        <Button size="sm" disabled={loadingOrders || !queueSearch.trim()}>{loadingOrders ? '…' : 'Go'}</Button>
                    </form>

                    {/* Sort (sm+) */}
                    <div className="relative z-20 hidden bg-transparent sm:block">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="h-11 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        >
                            <option value="paid_asc" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">เรียง: เก่า→ใหม่</option>
                            <option value="paid_desc" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">เรียง: ใหม่→เก่า</option>
                            <option value="order_id" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">เรียง: Order ID</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
                            <svg className="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                    </div>

                    {/* Spacer (sm+) */}
                    <div className="hidden flex-1 sm:block" />

                    {/* DatePicker */}
                    <div style={{ width: 150 }}>
                        <DatePicker
                            id="pack-date"
                            defaultDate={selectedDate}
                            displayFormat={formatShortBuddhist}
                            onChange={(_dates, str) => {
                                setSelectedDate(str);
                                setQueueSearch('');
                                void handleLoadOrders(str || null);
                            }}
                        />
                    </div>

                    {/* Lot + New Lot (sm+) */}
                    <div className="hidden items-center gap-2 sm:flex">
                        <div className="relative z-20 bg-transparent">
                            <select
                                value={selectedLotId ?? ''}
                                onChange={e => setSelectedLotId(e.target.value ? Number(e.target.value) : null)}
                                className={`h-11 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-800 ${selectedLotId ? 'text-gray-800 dark:text-white/90' : 'text-gray-400 dark:text-gray-400'}`}
                            >
                                <option value="" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">Lot: ทั้งหมด</option>
                                {lots.map(lot => <option key={lot.id} value={lot.id} className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">Lot #{lot.id}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
                                <svg className="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void handleCreateLot()} disabled={creatingLot}>
                            {creatingLot ? '…' : '+ New Lot'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Filter chips — when orders loaded */}
            {orders.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
                {([
                    { key: 'all',     label: 'ทั้งหมด',    count: orders.length, danger: false },
                    { key: 'overdue', label: '🔥 เร้งด่วน', count: overdueCount,  danger: true  },
                ] as const).map(({ key, label, count, danger }) => {
                    if (key === 'overdue' && count === 0) return null;
                    const active = queueFilter === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setQueueFilter(key)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                active
                                    ? danger ? 'border-error-500 bg-error-500 text-white' : 'border-brand-500 bg-brand-500 text-white'
                                    : danger ? 'border-error-200 bg-error-50 text-error-600 hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400'
                                             : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            {label} · {count}
                        </button>
                    );
                })}
            </div>
            )}

            {/* ── Row 4: 2-col grid (1-col on mobile) ── */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">

                {/* ── LEFT: Queue — hidden on mobile when detail showing ── */}
                <div className={`flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${mobileShowDetail ? 'hidden lg:flex' : 'flex'}`}>

                    {/* Queue header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            คิวออเดอร์ ({filteredOrders.length})
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">⟳ auto refresh</span>
                    </div>

                    {/* Queue list */}
                    <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                        {loadingOrders && (
                            <div className="flex h-20 items-center justify-center">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                            </div>
                        )}
                        {!loadingOrders && filteredOrders.length === 0 && (
                            <p className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">ไม่มีออเดอร์</p>
                        )}
                        {filteredOrders.map(order => (
                            <QueueItem
                                key={order.id}
                                order={order}
                                selected={selectedOrder?.id === order.id}
                                onClick={() => handleSelectOrder(order)}
                            />
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: Detail — hidden on mobile when no order ── */}
                <div className={`flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${mobileShowDetail ? 'flex' : 'hidden lg:flex'}`}>

                    {/* Empty state */}
                    {!selectedOrder && !loadingItems && !itemsError && (
                        <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                            <div className="mb-3 text-5xl">📦</div>
                            <h3 className="mb-1 text-lg font-bold text-gray-800 dark:text-white/90">พร้อมแพ็คแล้ว</h3>
                            <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                เลือกออเดอร์จากคิวด้านมือ<br />
                                หรือยิงบาร์โค้ดของสินค้าเข้าไปในช่องด้านล่าง ระบบจะหาออเดอร์ให้อัตโนมัติ
                            </p>
                            {/* Quick scan box */}
                            <div className="w-full max-w-md rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-4 dark:border-brand-600 dark:bg-brand-900/20">
                                <form onSubmit={e => { e.preventDefault(); const v = queueSearch.trim(); if (v) void handleQueueSearch(); }} className="flex gap-2">
                                    <span className="flex shrink-0 items-center text-xl">📷</span>
                                    <input
                                        type="text"
                                        value={queueSearch}
                                        onChange={e => setQueueSearch(e.target.value)}
                                        placeholder="ยิงบาร์โค้ด หรือ Order ID..."
                                        autoFocus
                                        className="h-11 flex-1 appearance-none rounded-lg border border-brand-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-brand-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                                    />
                                    <Button size="sm" disabled={!queueSearch.trim() || loadingOrders}>Go</Button>
                                </form>
                                <p className="mt-2 text-left text-[11px] text-gray-500 dark:text-gray-400">
                                    💡 รองรับ: Order ID (#8870), Member No (JNC0001), Barcode สินค้า
                                </p>
                            </div>
                            {/* Keyboard hints */}
                            <div className="mt-6 flex gap-5 text-[11px] text-gray-400">
                                <div><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">↑</kbd> <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">↓</kbd> เลือกคิว</div>
                                <div><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">Enter</kbd> เปิดออเดอร์</div>
                            </div>
                        </div>
                    )}

                    {loadingItems && !selectedOrder && (
                        <div className="flex flex-1 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        </div>
                    )}

                    {(selectedOrder || loadingItems || itemsError) && (
                        <>
                            {/* Detail header */}
                            {selectedOrder && (
                                <div className="shrink-0 border-b border-gray-100 dark:border-gray-700">
                                    {/* Top row */}
                                    <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5">
                                        {/* Back — mobile only */}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedOrder(null)}
                                            className="flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            <span className="text-xs">คิว</span>
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-lg font-extrabold text-gray-800 dark:text-white/90">#{selectedOrder.id}</span>
                                                {isPacked && <Badge color="success" size="sm">✓ Packed</Badge>}
                                                {isOverdue(selectedOrder) && <Badge color="error" size="sm">🔥 ค้างนาน</Badge>}
                                            </div>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                                {getOrderPaidAt(selectedOrder)?.toLocaleString('th-TH') ?? '—'}
                                                {selectedLotId ? ` · Lot #${selectedLotId}` : ''}
                                            </p>
                                        </div>
                                        {/* View More — icon-only on mobile, text on sm+ */}
                                        <Button size="sm" variant="outline" onClick={() => setIsOrderDetailsOpen(true)}>
                                            <svg className="size-4 sm:hidden" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 7h.01"/></svg>
                                            <span className="hidden sm:inline">View More</span>
                                        </Button>
                                        {/* Confirm Pack — hidden on mobile, shown sm+ */}
                                        {!isPacked && (
                                            <div className="hidden sm:block">
                                                <Button size="sm" variant="orange" disabled={!allScanned || confirming} onClick={() => void handleConfirmPack()}>
                                                    {confirming ? 'Confirming…' : 'Confirm Pack'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Mobile action bar — Confirm Pack full width */}
                                    {!isPacked && (
                                        <div className="px-3 pb-3 sm:hidden">
                                            <Button variant="orange" className="w-full" disabled={!allScanned || confirming} onClick={() => void handleConfirmPack()}>
                                                {confirming ? 'Confirming…' : 'Confirm Pack'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Scrollable body */}
                            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                                {loadingItems && (
                                    <div className="flex h-20 items-center justify-center">
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                                    </div>
                                )}
                                {itemsError && <p className="text-sm text-error-500">{itemsError}</p>}

                                {/* Customer info */}
                                {selectedOrder && (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <SectionCard title="Customer">
                                            <InfoRow label="Member No.">{selectedOrder.customer.username || '—'}</InfoRow>
                                            {selectedOrder.customer.phone && <InfoRow label="Phone">{selectedOrder.customer.phone}</InfoRow>}
                                        </SectionCard>
                                        <SectionCard
                                            title="Shipping"
                                            action={selectedOrder.shipping && (selectedOrder.shipping.name || selectedOrder.shipping.address) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const s = selectedOrder.shipping;
                                                        void navigator.clipboard.writeText([s.name, s.phone, s.address].filter(Boolean).join('\n'));
                                                        setToast('Copied shipping info');
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition"
                                                >Copy</button>
                                            ) : undefined}
                                        >
                                            {selectedOrder.shipping && (selectedOrder.shipping.name || selectedOrder.shipping.address) ? (
                                                <div className="space-y-0.5 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                                                    <p className="font-medium">{selectedOrder.shipping.name}</p>
                                                    {selectedOrder.shipping.phone && <p>{selectedOrder.shipping.phone}</p>}
                                                    {selectedOrder.shipping.address && <p className="whitespace-pre-line">{selectedOrder.shipping.address}</p>}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-amber-500 italic">รอข้อมูลจัดส่ง</span>
                                            )}
                                        </SectionCard>
                                    </div>
                                )}

                                {/* Inline scan bar */}
                                {items.length > 0 && !isPacked && (
                                    <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-3 dark:border-brand-500/40 dark:bg-brand-500/5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base shrink-0">🔷</span>
                                            <input
                                                ref={inlineScanRef}
                                                type="text"
                                                value={inlineBarcode}
                                                onChange={e => setInlineBarcode(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && inlineBarcode.trim()) void handleBarcodeInput(inlineBarcode.trim()); }}
                                                placeholder="ยิงบาร์โค้ดที่นี่ ระบบจะติ๊กสินค้าให้อัตโนมัติ…"
                                                className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-white/90 dark:placeholder:text-white/30"
                                                autoComplete="off"
                                            />
                                            <Button size="sm" onClick={() => { setScanResult(null); setCameraOpen(true); }} disabled={cameraOpen}>📷 กล้อง</Button>
                                        </div>
                                        {(validating || scanResult) && (
                                            <div className="mt-2 flex items-center gap-2">
                                                {validating
                                                    ? <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />Checking…</div>
                                                    : scanResult?.ok
                                                    ? <Badge color="success" size="sm">✅ {scanResult.name ?? 'Matched'}</Badge>
                                                    : <Badge color="error" size="sm">❌ {scanResult?.name ?? 'Barcode not recognised'}</Badge>
                                                }
                                            </div>
                                        )}
                                        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">กด Enter หรือใช้ 📷 เปิดกล้อง</p>
                                    </div>
                                )}

                                {/* Items table */}
                                {items.length > 0 && !loadingItems && (
                                    <BasicTableOne columns={ITEM_COLUMNS} rows={tableRows} />
                                )}

                                {/* Tracking — shown after pack */}
                                {lastPackedOrderId !== null && (
                                    <div className="rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10 space-y-3">
                                        <p className="text-sm font-semibold text-success-700 dark:text-success-400">📦 Order #{lastPackedOrderId} — Add Tracking</p>
                                        <div className="space-y-3">
                                            {parcels.map((parcel, i) => (
                                                <div key={i} className="space-y-1.5">
                                                    <div className="flex flex-wrap gap-1.5 items-center">
                                                        {CARRIERS.map(c => {
                                                            const sel = parcel.carrier === c.value;
                                                            return (
                                                                <button key={c.value} type="button"
                                                                    onClick={() => setParcels(prev => prev.map((p, idx) => idx === i ? { ...p, carrier: c.value } : p))}
                                                                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${sel ? `${c.bg} ${c.text} ring-2 ${c.ring} ring-offset-1` : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'}`}
                                                                >{c.short}</button>
                                                            );
                                                        })}
                                                        <span className="text-xs text-gray-400">{CARRIERS.find(c => c.value === parcel.carrier)?.label}</span>
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="Tracking number"
                                                            value={parcel.number}
                                                            onChange={e => setParcels(prev => prev.map((p, idx) => idx === i ? { ...p, number: e.target.value } : p))}
                                                            className="h-11 flex-1 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                                                        />
                                                        {parcel.number.trim() && (() => { const url = trackingUrl(parcel.carrier, parcel.number); return url ? (
                                                            <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                                                                <svg className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3H17M17 3V9M17 3L9 11M8 5H5C3.895 5 3 5.895 3 7V15C3 16.105 3.895 17 5 17H13C14.105 17 15 16.105 15 15V12"/></svg>
                                                            </Button>
                                                        ) : null; })()}
                                                        {parcels.length > 1 && (
                                                            <button type="button" onClick={() => setParcels(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-error-500 transition">
                                                                <svg className="size-4" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => setParcels(prev => [...prev, { carrier: 'kerry', number: '' }])} className="text-xs text-brand-500 hover:text-brand-600 font-medium">
                                            + Add Box
                                        </button>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="orange" disabled={savingTracking || !parcels.some(p => p.number.trim())} onClick={() => void handleSaveTracking()}>
                                                {savingTracking ? 'Saving…' : 'Save Tracking'}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setLastPackedOrderId(null)}>Skip</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Already-packed info */}
                                {isPacked && lastPackedOrderId === null && (
                                    <div className="flex items-center justify-end gap-3">
                                        <span className="text-sm font-medium text-success-600 dark:text-success-400">✓ Packed แล้ว</span>
                                        {selectedOrder && !['wait-shipping', 'shipped'].includes(selectedOrder.status) && (
                                            <Button size="sm" variant="outline" onClick={() => { setLastPackedOrderId(selectedOrder.id); setParcels([{ carrier: 'kerry', number: '' }]); }}>
                                                + Add Tracking
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Existing tracking display */}
                                {isPacked && (selectedOrder?.shipping?.tracking?.length ?? 0) > 0 && lastPackedOrderId === null && (
                                    <div className="flex flex-col gap-2">
                                        {selectedOrder!.shipping.tracking!.map((t, i) => {
                                            const c = CARRIERS.find(x => x.value === t.carrier);
                                            const url = trackingUrl(t.carrier, t.number);
                                            return (
                                                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5">
                                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${c ? `${c.bg} ${c.text}` : 'bg-gray-400 text-white'}`}>{c?.short ?? t.carrier.toUpperCase()}</span>
                                                    <span className="flex-1 select-all font-mono text-sm text-gray-800 dark:text-gray-200">{t.number}</span>
                                                    {url && (
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 transition">
                                                            <svg className="size-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3H17M17 3V9M17 3L9 11M8 5H5C3.895 5 3 5.895 3 7V15C3 16.105 3.895 17 5 17H13C14.105 17 15 16.105 15 15V12"/></svg>
                                                            Track
                                                        </a>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Camera modal ── */}
            <Modal isOpen={cameraOpen} onClose={() => setCameraOpen(false)} showCloseButton={false} className="max-w-sm mx-4">
                <div className="p-4 space-y-3">
                    <p className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {cameraFailed ? 'กรอก Barcode' : 'สแกน Barcode'}
                    </p>
                    <div className={`overflow-hidden rounded-xl ${cameraFailed ? 'hidden' : ''}`}>
                        <div id={SCANNER_ELEMENT_ID} className="w-full" />
                    </div>
                    {cameraFailed && <p className="text-xs text-center text-amber-500">เปิดกล้องไม่ได้ — กรอก barcode แทน</p>}
                    <div className={`space-y-2 ${cameraFailed ? '' : 'border-t border-gray-100 dark:border-gray-700 pt-3'}`}>
                        {!cameraFailed && <p className="text-xs text-gray-400 text-center">หรือกรอก barcode</p>}
                        <div className="flex gap-2">
                            <input
                                ref={manualInputRef}
                                type="text"
                                value={manualBarcode}
                                onChange={e => setManualBarcode(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && manualBarcode.trim()) void handleBarcodeInput(manualBarcode.trim()); }}
                                placeholder="กรอก barcode..."
                                className="h-11 flex-1 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                                autoComplete="off"
                            />
                            <button type="button" disabled={!manualBarcode.trim()} onClick={() => void handleBarcodeInput(manualBarcode.trim())} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                                Submit
                            </button>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setCameraOpen(false)} className="w-full">Cancel</Button>
                </div>
            </Modal>

            {/* ── Order Details Modal ── */}
            {selectedOrder && (
                <OrderDetails order={selectedOrder} isOpen={isOrderDetailsOpen} onClose={() => setIsOrderDetailsOpen(false)} />
            )}

            {/* ── Help Modal ── */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} className="max-w-lg">
                <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">คู่มือการใช้งาน Pack Order</h2>
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">ขั้นตอนการแพ็ค</p>
                        <ol className="list-none space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            {[
                                'หน้าจะโหลด queue ออเดอร์วันนี้ให้อัตโนมัติ · เปลี่ยนวันได้ที่ date picker',
                                'เลือกออเดอร์จาก queue ซ้ายมือ (เรียงตามเวลาชำระ เก่าสุดก่อน)',
                                'ตรวจสอบชื่อและที่อยู่จัดส่ง',
                                'ยิง barcode ที่ช่องสีน้ำเงิน หรือกด 📷 เปิดกล้อง',
                                'สแกนซ้ำจนตัวเลข Qty ครบทุก item (badge เปลี่ยนเป็นสีน้ำเงิน)',
                                'กด Confirm Pack (ปุ่มเปิดเมื่อสแกนครบ)',
                                'ใส่เลข tracking → Save & Mark Shipped หรือ Skip',
                            ].map((text, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">{i + 1}</span>
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-700" />
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">บริษัทขนส่ง</p>
                        <div className="flex flex-wrap gap-2">
                            {CARRIERS.map(c => (
                                <span key={c.value} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c.bg} ${c.text}`}>
                                    {c.short} <span className="font-normal opacity-80">{c.label}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* ── Mobile floating scan ── */}
            {items.length > 0 && !loadingItems && !allScanned && (
                <div className="fixed bottom-6 right-6 z-40 xl:hidden">
                    <button
                        onClick={() => { setScanResult(null); setCameraOpen(true); }}
                        disabled={cameraOpen}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20 active:scale-95 transition-all"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
