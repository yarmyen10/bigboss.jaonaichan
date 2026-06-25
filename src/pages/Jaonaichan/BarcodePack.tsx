import { useEffect, useRef, useState, ReactNode } from 'react';
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
    getOrders,
    getOrder,
} from '../../services/jaonaichan';
import type { BarcodeOrderItem } from '../../interfaces/barcode.jaonaichan';
import type { Order } from '../../interfaces/order.jaonaichan';

// Extended item to include data from getOrder
interface EnhancedBarcodeOrderItem extends BarcodeOrderItem {
    sku?: string;
    image?: string | null;
}

const SCANNER_ELEMENT_ID = 'barcode-pack-reader';

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

interface Html5QrcodeInstance {
    start(
        cameraConfig: { facingMode: string },
        config: { fps: number; qrbox: { width: number; height: number } },
        onScanSuccess: (decodedText: string) => void,
        onScanError: (error: string) => void
    ): Promise<void>;
    stop(): Promise<void>;
}

type WindowWithScanner = Window & {
    Html5Qrcode?: new (id: string) => Html5QrcodeInstance;
};

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

    const [orderId, setOrderId] = useState('');
    const [items, setItems] = useState<EnhancedBarcodeOrderItem[]>([]);
    const [scanned, setScanned] = useState<Record<number, string[]>>({});
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemsError, setItemsError] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [toast, setToast] = useState('');
    const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

    const hasInitialized = useRef(false);
    const scannerRef = useRef<Html5QrcodeInstance | null>(null);

    // Inject Html5Qrcode from CDN once on mount
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        if (document.getElementById('html5qrcode-script')) return;
        const script = document.createElement('script');
        script.id = 'html5qrcode-script';
        script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        document.body.appendChild(script);
    }, []);

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Camera lifecycle
    useEffect(() => {
        if (!cameraOpen) return;

        let stopped = false;

        const timer = setTimeout(async () => {
            const Html5Qrcode = (window as WindowWithScanner).Html5Qrcode;
            if (!Html5Qrcode) {
                setCameraOpen(false);
                return;
            }

            let scanner: Html5QrcodeInstance | undefined;
            try {
                const el = document.getElementById(SCANNER_ELEMENT_ID);
                if (!el) {
                    setToast("Scanner element not ready yet.");
                    setCameraOpen(false);
                    return;
                }
                scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
                scannerRef.current = scanner;
                const capturedScanner = scanner;

                const onScanSuccess = async (barcode: string) => {
                    if (stopped) return;
                    stopped = true;
                    try { await capturedScanner.stop(); } catch { /* scanner already stopped */ }
                    scannerRef.current = null;
                    setCameraOpen(false);

                    try {
                        const res = await validateBarcode(barcode);
                        setScanned((prev) => ({
                            ...prev,
                            [res.product_id]: [...(prev[res.product_id] ?? []), barcode],
                        }));
                        setScanResult({ ok: true, name: res.product_name });
                    } catch {
                        setScanResult({ ok: false });
                    }
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
            } catch (err: any) {
                console.error("Camera start error:", err);
                setToast(err?.message || "Failed to open camera. Please check permissions or use HTTPS.");
                setCameraOpen(false);
            }
        }, 150);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current && !stopped) {
                stopped = true;
                scannerRef.current.stop().catch(() => {});
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
            const res = await getOrders({ createDate, status: 'processing', perPage: 100 });
            
            const sorted = res.data.sort((a, b) => {
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

    const handleConfirmPack = async () => {
        setConfirming(true);
        try {
            await confirmPack(Number(orderId), scanned);
            setToast('Pack confirmed successfully!');
            setItems([]);
            setScanned({});
            setOrderId('');
            setScanResult(null);
            setSelectedOrder(null);
            
            if (orders.length > 0) {
                void handleLoadOrders();
            }
        } catch {
            setToast('Failed to confirm pack. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    const allScanned =
        items.length > 0 &&
        items.every((item) => (scanned[item.product_id]?.length ?? 0) >= item.qty);

    const isHttps = window.location.protocol === 'https:';

    const tableRows = items.map((item, index) => {
        const scannedCount = scanned[item.product_id]?.length ?? 0;
        const done = scannedCount >= item.qty;

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
                        {scannedCount}/{item.qty}
                    </Badge>
                </div>
            ),
            action: (
                <div className="text-center w-full">
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
                </div>
            )
        };
    });

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                Pack Order
            </h1>

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
                    {scanResult && (
                        <div className="flex items-center gap-2">
                            {scanResult.ok ? (
                                <Badge color="success">✅ {scanResult.name ?? 'Matched'}</Badge>
                            ) : (
                                <Badge color="error">❌ Barcode not recognised</Badge>
                            )}
                        </div>
                    )}

                    {/* Items Table using BasicTableOne */}
                    {items.length > 0 && !loadingItems && (
                        <div className="space-y-4">
                            <BasicTableOne columns={ITEM_COLUMNS} rows={tableRows} />
                            
                            <div className="flex justify-end pt-4">
                                <Button
                                    variant="orange"
                                    disabled={!allScanned || confirming}
                                    onClick={() => void handleConfirmPack()}
                                    className="w-full sm:w-auto min-w-[200px]"
                                >
                                    {confirming ? 'Confirming…' : 'Confirm Pack'}
                                </Button>
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
                        สแกน Barcode
                    </p>
                    <div className="overflow-hidden rounded-xl">
                        <div id={SCANNER_ELEMENT_ID} className="w-full" />
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
