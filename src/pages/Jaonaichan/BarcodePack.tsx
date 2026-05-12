import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/button/Button';
import Badge from '../../components/ui/badge/Badge';
import Input from '../../components/form/input/InputField';
import {
    getBarcodeOrderItems,
    validateBarcode,
    confirmPack,
} from '../../services/jaonaichan';
import type { BarcodeOrderItem } from '../../interfaces/barcode.jaonaichan';

const SCANNER_ELEMENT_ID = 'barcode-pack-reader';

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

export default function BarcodePack() {
    const [orderId, setOrderId] = useState('');
    const [items, setItems] = useState<BarcodeOrderItem[]>([]);
    const [scanned, setScanned] = useState<Record<number, string[]>>({});
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemsError, setItemsError] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [toast, setToast] = useState('');

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

    // Camera lifecycle — start when cameraOpen becomes true, clean up on false
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
                scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
                scannerRef.current = scanner;
                const capturedScanner = scanner;

                await capturedScanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 280, height: 150 } },
                    async (barcode) => {
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
                    },
                    () => { /* per-frame decode error — intentionally ignored */ }
                );
            } catch {
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

    const handleLoadItems = async () => {
        const id = Number(orderId.trim());
        if (!id) return;
        setLoadingItems(true);
        setItemsError('');
        setItems([]);
        setScanned({});
        setScanResult(null);
        try {
            const res = await getBarcodeOrderItems(id);
            if (res.items.length === 0) {
                setItemsError('No items found for this order.');
            } else {
                setItems(res.items);
            }
        } catch {
            setItemsError('Failed to load order items.');
        } finally {
            setLoadingItems(false);
        }
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

    return (
        <div className="mx-auto max-w-lg space-y-4">
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

            {/* Order ID input */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleLoadItems();
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
                    />
                </div>
                <Button size="sm" disabled={loadingItems || !orderId.trim()}>
                    {loadingItems ? 'Loading…' : 'Load'}
                </Button>
            </form>

            {itemsError && (
                <p className="text-sm text-error-500">{itemsError}</p>
            )}

            {/* Item list */}
            {items.length > 0 && (
                <div className="space-y-3">
                    {items.map((item) => {
                        const scannedCount = scanned[item.product_id]?.length ?? 0;
                        const done = scannedCount >= item.qty;
                        return (
                            <div
                                key={item.order_item_id}
                                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-gray-800 dark:text-white/90">
                                        {item.name}
                                    </p>
                                    <Badge color={done ? 'success' : 'warning'} size="sm">
                                        {scannedCount}/{item.qty}
                                    </Badge>
                                </div>
                                {(scanned[item.product_id]?.length ?? 0) > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {scanned[item.product_id].map((bc, i) => (
                                            <Badge key={`${item.order_item_id}-${i}`} color="light" size="sm">
                                                {bc}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Scan controls */}
            {items.length > 0 && (
                <div className="space-y-3">
                    {/* Last scan result */}
                    {scanResult && (
                        <div className="flex items-center gap-2">
                            {scanResult.ok ? (
                                <Badge color="success">✅ {scanResult.name ?? 'Matched'}</Badge>
                            ) : (
                                <Badge color="error">❌ Barcode not recognised</Badge>
                            )}
                        </div>
                    )}

                    {/* Open Camera */}
                    {!cameraOpen && (
                        <button
                            type="button"
                            onClick={() => {
                                setScanResult(null);
                                setCameraOpen(true);
                            }}
                            disabled={allScanned}
                            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Open Camera
                        </button>
                    )}

                    {/* Camera view */}
                    {cameraOpen && (
                        <div className="space-y-2">
                            <div className="mx-auto max-w-sm overflow-hidden rounded-xl">
                                <div id={SCANNER_ELEMENT_ID} className="w-full" />
                            </div>
                            <button
                                type="button"
                                onClick={() => setCameraOpen(false)}
                                className="flex h-12 w-full items-center justify-center rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Confirm Pack */}
                    <Button
                        variant="orange"
                        disabled={!allScanned || confirming}
                        onClick={() => void handleConfirmPack()}
                        className="w-full"
                    >
                        {confirming ? 'Confirming…' : 'Confirm Pack'}
                    </Button>
                </div>
            )}
        </div>
    );
}
