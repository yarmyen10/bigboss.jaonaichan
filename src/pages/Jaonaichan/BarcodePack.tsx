import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '../../components/ui/button/Button';
import Badge from '../../components/ui/badge/Badge';
import Input from '../../components/form/input/InputField';
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

// Extended item to include data from getOrder
interface EnhancedBarcodeOrderItem extends BarcodeOrderItem {
    sku?: string;
    image?: string | null;
}

const SCANNER_ELEMENT_ID = 'barcode-pack-reader';

// statuses ที่ถือว่า "pack แล้ว" ในหน้านี้
const PACKED_STATUSES = new Set(['packed', 'wait-tracking', 'tracked']);

const CARRIERS: { value: TrackingParcel['carrier']; label: string; short: string; bg: string; text: string; ring: string }[] = [
    { value: 'kerry',    label: 'Kerry Express',     short: 'KEX',      bg: 'bg-[#E30013]',  text: 'text-white', ring: 'ring-[#E30013]' },
    { value: 'flash',    label: 'Flash Express',     short: 'FLASH',    bg: 'bg-[#FF6B00]',  text: 'text-white', ring: 'ring-[#FF6B00]' },
    { value: 'jt',       label: 'J&T Express',       short: 'J&T',      bg: 'bg-[#E8000D]',  text: 'text-white', ring: 'ring-[#E8000D]' },
    { value: 'thaipost', label: 'ไปรษณีย์ไทย',      short: 'POST',     bg: 'bg-[#6B2D8B]',  text: 'text-white', ring: 'ring-[#6B2D8B]' },
];

const trackingUrl = (carrier: string, number: string): string | null => {
    const n = encodeURIComponent(number.trim());
    const map: Record<string, string> = {
        kerry:    `https://th.kex-express.com/en/track/?track=${n}`,
        flash:    `https://flashexpress.com/tracking/?se=${n}`,
        jt:       `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${n}`,
        thaipost: `https://track.thailandpost.co.th/?trackNumber=${n}`,
    };
    return map[carrier] ?? null;
};

const PAYMENT_LABEL: Record<string, string> = {
    promptpay_qr:  "PromptPay QR",
    bank_transfer: "Bank Transfer",
    cod:           "Cash on Delivery",
};

function parseAddressLines(raw: string): string[] {
    return raw
        .split(/<br\s*\/?>/i)
        .map((line) => line.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);
}


interface ScanResult {
    ok: boolean;
    name?: string;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">{children}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 min-w-0 overflow-hidden bg-white dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </p>
      {children}
    </div>
  );
}

const ITEM_COLUMNS: BasicTableColumn[] = [
    { key: "no", label: "No.", className: "text-center w-12" },
    { key: "photo", label: "Photo", className: "text-center w-16" },
    { key: "code", label: "Code" },
    { key: "name", label: "Item Name", className: "min-w-[200px]" },
    { key: "qty", label: "Qty", className: "text-center w-24" },
    { key: "action", label: "Action", className: "text-center w-24 hidden xl:table-cell" },
];

export default function BarcodePack() {
    // Ponytail note: Using a simple HTML5 date input instead of complex custom date picker.
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const [lots, setLots] = useState<Lot[]>([]);
    const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
    const [creatingLot, setCreatingLot] = useState(false);

    const [orderId, setOrderId] = useState('');
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
    const [cameraFailed, setCameraFailed] = useState(false);
    const manualInputRef = useRef<HTMLInputElement>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const itemsRef = useRef<EnhancedBarcodeOrderItem[]>([]);

    // Keep ref in sync so camera closure can read current items
    useEffect(() => { itemsRef.current = items; }, [items]);

    // Load lots on mount
    useEffect(() => {
        getLots().then(setLots).catch(() => {});
    }, []);

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleBarcodeInput = useCallback(async (barcode: string) => {
        setCameraOpen(false);
        setManualBarcode('');
        setValidating(true);
        try {
            const res = await validateBarcode(barcode);
            const matchedItem = itemsRef.current.find(i => i.product_id === res.product_id);
            if (!matchedItem) {
                setScanResult({ ok: false, name: `Product ID ${res.product_id} not in this order (order has: ${itemsRef.current.map(i => i.product_id).join(', ')})` });
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

    // Auto-focus manual input when camera fails
    useEffect(() => {
        if (cameraFailed) manualInputRef.current?.focus();
    }, [cameraFailed]);

    // Camera lifecycle
    useEffect(() => {
        if (!cameraOpen) return;
        setCameraFailed(false);

        let stopped = false;

        const timer = setTimeout(async () => {
            let scanner: Html5Qrcode | undefined;
            try {
                const el = document.getElementById(SCANNER_ELEMENT_ID);
                if (!el) {
                    setToast("Scanner element not ready yet.");
                    setCameraOpen(false);
                    return;
                }
                scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
                const capturedScanner = scanner;

                const onScanSuccess = async (barcode: string) => {
                    if (stopped) return;
                    stopped = true;
                    try { await capturedScanner.stop(); } catch { /* scanner already stopped */ }
                    scannerRef.current = null;
                    handleBarcodeInput(barcode);
                };

                try {
                    await capturedScanner.start(
                        { facingMode: 'environment' },
                        { fps: 10, qrbox: { width: 280, height: 150 } },
                        onScanSuccess,
                        () => { /* ignore per-frame decode errors */ }
                    );
                } catch (err1) {
                    console.warn("Failed to open environment camera, trying user camera...", err1);
                    await capturedScanner.start(
                        { facingMode: 'user' },
                        { fps: 10, qrbox: { width: 280, height: 150 } },
                        onScanSuccess,
                        () => { /* ignore per-frame decode errors */ }
                    );
                }
                scannerRef.current = scanner; // only set after a successful start
            } catch (err: any) {
                console.error("Camera start error:", err);
                scannerRef.current = null; // ensure cleanup won't stop() an unstarted scanner
                setCameraFailed(true);
            }
        }, 150);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current && !stopped) {
                stopped = true;
                try { scannerRef.current.stop().catch(() => {}); } catch { /* not started */ }
                scannerRef.current = null;
            }
        };
    }, [cameraOpen]);

    const handleLoadOrders = async () => {
        if (!selectedDate) return;
        setLoadingOrders(true);
        try {
            const [y, m, d] = selectedDate.split('-');
            const createDate = `${d}/${m}/${y}`;
            const res = await getOrders({ createDate, status: 'paid-2', perPage: 100 });
            
            const sorted = res.data
                .filter((o) => o.status === 'paid-2')
                .sort((a, b) => {
                    const timeA = a.bill2?.paid_at ? new Date(a.bill2.paid_at).getTime() : 0;
                    const timeB = b.bill2?.paid_at ? new Date(b.bill2.paid_at).getTime() : 0;
                    return timeA - timeB;
                });
            setOrders(sorted);
        } catch (err: any) {
            setToast('Failed to load orders: ' + err.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const loadItemsForOrderId = async (id: number) => {
        setLoadingItems(true);
        setItemsError('');
        setItems([]);
        setScanned({});
        setScanResult(null);
        setLastPackedOrderId(null);
        try {
            const [res, orderDetail] = await Promise.all([
                getBarcodeOrderItems(id),
                getOrder(id).catch(() => null)
            ]);

            if (orderDetail) {
                setSelectedOrder(orderDetail);
            } else {
                setSelectedOrder(null);
            }

            if (res.items.length === 0) {
                setItemsError('No items found for this order.');
            } else {
                const enhancedItems: EnhancedBarcodeOrderItem[] = res.items.map(item => {
                    const matchedItem = orderDetail?.items?.find(oi => oi.item_id === item.order_item_id);
                    return {
                        ...item,
                        sku: matchedItem?.product?.sku,
                        image: matchedItem?.product?.image?.thumbnail
                    };
                });
                setItems(enhancedItems);
            }

            if (orderDetail && PACKED_STATUSES.has(orderDetail.status) && orderDetail.status !== 'tracked') {
                const hasTracking = (orderDetail.shipping?.tracking?.length ?? 0) > 0;
                if (!hasTracking) {
                    setLastPackedOrderId(orderDetail.id);
                    setParcels([{ carrier: 'kerry', number: '' }]);
                }
            }
        } catch {
            setItemsError('Failed to load order items.');
        } finally {
            setLoadingItems(false);
        }
    };

    const handleLoadItemsManual = async () => {
        const id = Number(orderId.trim());
        if (!id) return;
        setSelectedOrder(null);
        await loadItemsForOrderId(id);
    };

    const handleSelectOrder = async (order: Order) => {
        setSelectedOrder(order);
        setOrderId(String(order.id));
        await loadItemsForOrderId(order.id);
    };

    const handleCreateLot = async () => {
        setCreatingLot(true);
        try {
            const lot = await createLot();
            setLots((prev) => [lot, ...prev]);
            setSelectedLotId(lot.id);
        } catch {
            setToast('Failed to create lot.');
        } finally {
            setCreatingLot(false);
        }
    };

    const handleConfirmPack = async () => {
        setConfirming(true);
        try {
            const packedId = Number(orderId);
            await confirmPack(packedId, scanned, selectedLotId ?? undefined);
            setLastPackedOrderId(packedId);
            setParcels([{ carrier: 'kerry', number: '' }]);
            setItems([]);
            setScanned({});
            setOrderId('');
            setScanResult(null);
            setSelectedOrder(null);
            if (orders.length > 0) void handleLoadOrders();
        } catch {
            setToast('Failed to confirm pack. Please try again.');
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
            setToast(`Order #${lastPackedOrderId} — tracking saved, status → shipped`);
            setLastPackedOrderId(null);
        } catch {
            setToast('Failed to save tracking.');
        } finally {
            setSavingTracking(false);
        }
    };

    const allScanned =
        items.length > 0 &&
        items.every((item) => (scanned[item.product_id]?.length ?? 0) >= item.qty);

    const isHttps = window.location.protocol === 'https:';

    const tableRows = items.map((item, index) => {
        const scannedCount = scanned[item.product_id]?.length ?? 0;
        const isPacked = !!selectedOrder && PACKED_STATUSES.has(selectedOrder.status);
        const done = isPacked || scannedCount >= item.qty;
        const displayCount = isPacked ? item.qty : scannedCount;

        return {
            no: <div className="text-center w-full">{index + 1}</div>,
            photo: item.image ? (
                <img src={item.image} alt="" className="mx-auto h-10 w-10 rounded object-cover bg-gray-100 dark:bg-gray-800" />
            ) : (
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-800">-</div>
            ),
            code: <span className="font-medium text-gray-900 dark:text-white">{item.sku || '-'}</span>,
            name: <p className="font-medium text-gray-800 dark:text-white/90 line-clamp-2">{item.name}</p>,
            qty: (
                <div className="text-center w-full">
                    <Badge color={done ? 'primary' : 'light'} size="sm">
                        {displayCount}/{item.qty}
                    </Badge>
                </div>
            ),
            action: (
                <div className="text-center w-full">
                    {isPacked ? (
                        <Badge color="primary" size="sm">✓</Badge>
                    ) : (
                        <Button
                            size="sm"
                            disabled={done || cameraOpen}
                            onClick={() => {
                                setScanResult(null);
                                setCameraOpen(true);
                            }}
                        >
                            Scan
                        </Button>
                    )}
                </div>
            )
        };
    });

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                    Pack Order
                </h1>
                <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-400 transition"
                    title="คู่มือการใช้งาน"
                >
                    ?
                </button>
            </div>

            {/* HTTPS warning */}
            {!isHttps && (
                <div className="rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
                    Camera access requires HTTPS. Barcode scanning may not work on this connection.
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="rounded-lg border border-success-300 bg-success-50 px-4 py-3 text-sm font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                    {toast}
                </div>
            )}

            {/* Lot Selector */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lot</p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <select
                            value={selectedLotId ?? ''}
                            onChange={(e) => setSelectedLotId(e.target.value ? Number(e.target.value) : null)}
                            className={`h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-800 ${selectedLotId ? 'text-gray-800 dark:text-white/90' : 'text-gray-400 dark:text-gray-400'}`}
                        >
                            <option value="" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">Select a lot…</option>
                            {lots.map((lot) => (
                                <option key={lot.id} value={lot.id} className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                    Lot #{lot.id} — {lot.status}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
                            <svg className="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleCreateLot()} disabled={creatingLot}>
                        {creatingLot ? '…' : '+ New Lot'}
                    </Button>
                </div>
            </div>

            {/* Tracking section — shown after pack confirmed */}
            {lastPackedOrderId !== null && (
                <div className="rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10 space-y-3">
                    <p className="text-sm font-semibold text-success-700 dark:text-success-400">
                        📦 Order #{lastPackedOrderId} — Add Tracking
                    </p>
                    <div className="space-y-3">
                        {parcels.map((parcel, i) => (
                            <div key={i} className="space-y-1.5">
                                {/* Carrier pills */}
                                <div className="flex flex-wrap gap-1.5">
                                    {CARRIERS.map(c => {
                                        const selected = parcel.carrier === c.value;
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setParcels(prev => prev.map((p, idx) => idx === i ? { ...p, carrier: c.value } : p))}
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${selected ? `${c.bg} ${c.text} ring-2 ${c.ring} ring-offset-1` : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                            >
                                                {c.short}
                                            </button>
                                        );
                                    })}
                                    <span className="self-center text-xs text-gray-400 dark:text-gray-500">
                                        {CARRIERS.find(c => c.value === parcel.carrier)?.label}
                                    </span>
                                </div>
                                {/* Tracking number + remove */}
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Tracking number"
                                        value={parcel.number}
                                        onChange={(e) => setParcels(prev => prev.map((p, idx) => idx === i ? { ...p, number: e.target.value } : p))}
                                        className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
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
                    <button
                        type="button"
                        onClick={() => setParcels(prev => [...prev, { carrier: 'kerry', number: '' }])}
                        className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                    >
                        + Add Box
                    </button>
                    <div className="flex gap-2 pt-1">
                        <Button
                            size="sm"
                            variant="orange"
                            disabled={savingTracking || !parcels.some(p => p.number.trim())}
                            onClick={() => void handleSaveTracking()}
                        >
                            {savingTracking ? 'Saving…' : 'Save & Mark Shipped'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setLastPackedOrderId(null)}>
                            Skip
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr] gap-6 items-start">
                {/* LEFT COLUMN: Search and Order List */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 space-y-4">
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Find by Date</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <DatePicker
                                        id="barcode-pack-date-picker"
                                        defaultDate={selectedDate}
                                        onChange={(_dates, dateStr) => setSelectedDate(dateStr)}
                                    />
                                </div>
                                <Button size="sm" onClick={() => void handleLoadOrders()} disabled={loadingOrders || !selectedDate}>
                                    {loadingOrders ? 'Loading…' : 'Find'}
                                </Button>
                            </div>
                            
                            {orders.length > 0 && (
                                <div className="max-h-96 overflow-y-auto space-y-1 mt-2 custom-scrollbar">
                                    {orders.map((o) => (
                                        <button
                                            key={o.id}
                                            onClick={() => void handleSelectOrder(o)}
                                            className={`w-full flex justify-between items-center p-2 rounded-lg border text-sm transition-colors
                                                ${selectedOrder?.id === o.id 
                                                    ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' 
                                                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            <span className="font-medium">#{o.id} - {o.customer.name}</span>
                                            <span className="text-xs text-gray-500">{o.bill2?.paid_at ? new Date(o.bill2.paid_at).toLocaleString('th-TH') : 'Unpaid'}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                            <span className="text-xs font-medium text-gray-400 uppercase">OR</span>
                            <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Manual Order ID</p>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleLoadItemsManual();
                                }}
                                className="flex gap-2"
                            >
                                <div className="flex-1">
                                    <Input
                                        type="number"
                                        placeholder="Order ID"
                                        value={orderId}
                                        onChange={(e) => setOrderId(e.target.value)}
                                        disabled={loadingItems}
                                        className="!text-base"
                                    />
                                </div>
                                <Button size="sm" onClick={() => void handleLoadItemsManual()} disabled={loadingItems || !orderId.trim()}>
                                    {loadingItems ? 'Loading…' : 'Load'}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Details and Items Table */}
                <div className="space-y-6">
                    {!selectedOrder && !items.length && !loadingItems && !itemsError && (
                        <div className="flex flex-col min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
                            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-theme-sm dark:bg-gray-800">
                                <CatShopping className="h-12 w-12 text-brand-500" />
                            </div>
                            <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">No Order Selected</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                                Please select an order from the list on the left or enter an Order ID manually to begin packing.
                            </p>
                        </div>
                    )}

                    {loadingItems && (
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        </div>
                    )}

                    {itemsError && (
                        <p className="text-sm text-error-500">{itemsError}</p>
                    )}

                    {/* Customer Info Cards */}
                    {selectedOrder && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                                    Customer Information
                                </h2>
                                <Button size="sm" variant="outline" onClick={() => setIsOrderDetailsOpen(true)}>
                                    View More
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <SectionCard title="Customer">
                                    <InfoRow label="Name">{selectedOrder.customer.name}</InfoRow>
                                    <InfoRow label="Email">{selectedOrder.customer.email}</InfoRow>
                                    {selectedOrder.customer.phone && (
                                        <InfoRow label="Phone">{selectedOrder.customer.phone}</InfoRow>
                                    )}
                                </SectionCard>

                                <SectionCard title="Billing & Shipping">
                                    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-3 min-w-0">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-xs text-gray-400 dark:text-gray-500">Billing Address</span>
                                                {selectedOrder.billing?.address ? (
                                                    parseAddressLines(selectedOrder.billing.address).map((line, i) => (
                                                        <span key={i} className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">
                                                            {line}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                                )}
                                            </div>
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-auto">
                                                <InfoRow label="Payment method">
                                                    {PAYMENT_LABEL[selectedOrder.payment_method] ?? selectedOrder.payment_method}
                                                </InfoRow>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 min-w-0 border-t lg:border-t-0 xl:border-t 2xl:border-t-0 lg:border-l xl:border-l-0 2xl:border-l border-gray-100 dark:border-gray-800 pt-4 lg:pt-0 xl:pt-4 2xl:pt-0 lg:pl-4 xl:pl-0 2xl:pl-4 relative">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-xs text-gray-400 dark:text-gray-500 pr-6">Shipping Info</span>
                                                {selectedOrder.shipping && (selectedOrder.shipping.name || selectedOrder.shipping.address) ? (
                                                    <>
                                                        <span className="text-sm font-medium text-gray-800 dark:text-white/90 break-words mt-1">
                                                            {selectedOrder.shipping.name}
                                                        </span>
                                                        {selectedOrder.shipping.phone && (
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                {selectedOrder.shipping.phone}
                                                            </span>
                                                        )}
                                                        {selectedOrder.shipping.address && (
                                                            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line mt-1">
                                                                {selectedOrder.shipping.address}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-amber-500 mt-1 italic">รอข้อมูลจัดส่ง</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>
                            </div>
                        </div>
                    )}

                    {/* Scan Result Feedback */}
                    {(validating || scanResult) && (
                        <div className="flex items-center gap-2">
                            {validating ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                                    Checking barcode…
                                </div>
                            ) : scanResult?.ok ? (
                                <Badge color="success">✅ {scanResult.name ?? 'Matched'}</Badge>
                            ) : (
                                <Badge color="error">❌ {scanResult?.name ?? 'Barcode not recognised'}</Badge>
                            )}
                        </div>
                    )}

                    {/* Items Table using BasicTableOne */}
                    {items.length > 0 && !loadingItems && (
                        <div className="space-y-4">
                            <BasicTableOne columns={ITEM_COLUMNS} rows={tableRows} />
                            
                            <div className="flex flex-col items-end gap-2 pt-4">
                                {selectedOrder && PACKED_STATUSES.has(selectedOrder.status) ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-success-600 dark:text-success-400">✓ Packed แล้ว</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => { setLastPackedOrderId(selectedOrder.id); setParcels([{ carrier: 'kerry', number: '' }]); }}
                                        >
                                            + Add Tracking
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {allScanned && !selectedLotId && (
                                            <p className="text-xs text-warning-500">Please select a lot before confirming.</p>
                                        )}
                                        <Button
                                            variant="orange"
                                            disabled={!allScanned || confirming || !selectedLotId}
                                            onClick={() => void handleConfirmPack()}
                                            className="w-full sm:w-auto min-w-[200px]"
                                        >
                                            {confirming ? 'Confirming…' : 'Confirm Pack'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Camera modal */}
            <Modal
                isOpen={cameraOpen}
                onClose={() => setCameraOpen(false)}
                showCloseButton={false}
                className="max-w-sm mx-4"
            >
                <div className="p-4 space-y-3">
                    <p className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {cameraFailed ? 'กรอก Barcode' : 'สแกน Barcode'}
                    </p>
                    <div className={`overflow-hidden rounded-xl ${cameraFailed ? 'hidden' : ''}`}>
                        <div id={SCANNER_ELEMENT_ID} className="w-full" />
                    </div>
                    {cameraFailed && (
                        <p className="text-xs text-center text-amber-500">เปิดกล้องไม่ได้ — กรอก barcode แทน</p>
                    )}
                    <div className={`space-y-2 ${cameraFailed ? '' : 'border-t border-gray-100 dark:border-gray-700 pt-3'}`}>
                        {!cameraFailed && <p className="text-xs text-gray-400 text-center">หรือกรอก barcode</p>}
                        <div className="flex gap-2">
                            <input
                                ref={manualInputRef}
                                type="text"
                                value={manualBarcode}
                                onChange={e => setManualBarcode(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && manualBarcode.trim()) handleBarcodeInput(manualBarcode.trim()); }}
                                placeholder="กรอก barcode..."
                                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                disabled={!manualBarcode.trim()}
                                onClick={() => handleBarcodeInput(manualBarcode.trim())}
                                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-40"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCameraOpen(false)}
                        className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        Cancel
                    </button>
                </div>
            </Modal>

            {/* Order Details Modal */}
            {selectedOrder && (
                <OrderDetails
                    order={selectedOrder}
                    isOpen={isOrderDetailsOpen}
                    onClose={() => setIsOrderDetailsOpen(false)}
                />
            )}

            {/* Help Modal */}
            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} className="max-w-lg">
                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">คู่มือการใช้งาน Pack Order</h2>

                    {/* ขั้นตอน */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">ขั้นตอนการแพ็ค</p>
                        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-none">
                            {[
                                { n: '1', text: 'เลือก Lot จาก dropdown หรือกด "+ New Lot" เพื่อสร้างใหม่' },
                                { n: '2', text: 'ค้นหา Order ด้วยวันที่ → กด Find → เลือก order จากรายการ หรือใส่ Order ID แล้วกด Load' },
                                { n: '3', text: 'ตรวจสอบข้อมูลลูกค้า ชื่อ และที่อยู่จัดส่ง' },
                                { n: '4', text: 'กดปุ่ม Scan ที่แถวสินค้า แล้วสแกน barcode ของสินค้านั้น' },
                                { n: '5', text: 'สแกนซ้ำจนตัวเลข Qty ครบทุก item (badge เปลี่ยนเป็นสีน้ำเงิน)' },
                                { n: '6', text: 'กด Confirm Pack (ปุ่มเปิดเมื่อสแกนครบ + เลือก Lot แล้วเท่านั้น)' },
                                { n: '7', text: 'เลือกขนส่ง (KEX / FLASH / J&T / POST) ใส่เลข tracking ต่อกล่อง → Save & Mark Shipped หรือ Skip' },
                            ].map(({ n, text }) => (
                                <li key={n} className="flex gap-3">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 text-xs font-bold">{n}</span>
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Carrier reference */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">บริษัทขนส่ง</p>
                        <div className="flex flex-wrap gap-2">
                            {CARRIERS.map(c => (
                                <span key={c.value} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
                                    <span>{c.short}</span>
                                    <span className="font-normal opacity-80">{c.label}</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700" />

                    {/* กฎสำคัญ */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">กฎสำคัญ</p>
                        <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                            {[
                                'สแกนเฉพาะ barcode ของสินค้าที่อยู่ใน order นั้นเท่านั้น',
                                'ต้องเลือก Lot ก่อนถึงจะกด Confirm Pack ได้',
                                'Order ที่ค้นหาได้ต้องมีสถานะ "ชำระแล้ว (ครั้งที่ 2)" เท่านั้น',
                                'ต้องเปิดเว็บด้วย HTTPS — กล้องไม่ทำงานบน http://',
                            ].map((rule, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                                    <span>{rule}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700" />

                    {/* Troubleshoot */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Scan ไม่ผ่าน</p>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
                            {[
                                { msg: '❌ Barcode not recognised', cause: 'barcode ไม่อยู่ในระบบ หรือถูกแพ็คไปแล้ว' },
                                { msg: '❌ Product ID X not in this order', cause: 'barcode เป็นของสินค้าอื่น ไม่ใช่ order นี้' },
                                { msg: 'กล้องไม่เปิด', cause: 'ต้องใช้ HTTPS และกดอนุญาตกล้องในเบราเซอร์' },
                            ].map(({ msg, cause }, i) => (
                                <div key={i} className={`flex gap-3 p-3 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                                    <span className="font-medium text-error-600 dark:text-error-400 shrink-0 min-w-0">{msg}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{cause}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Mobile Floating Scan Button */}
            {items.length > 0 && !loadingItems && !allScanned && (
                <div className="fixed bottom-6 right-6 z-40 xl:hidden">
                    <button
                        onClick={() => {
                            setScanResult(null);
                            setCameraOpen(true);
                        }}
                        disabled={cameraOpen}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20 active:scale-95 transition-all"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
