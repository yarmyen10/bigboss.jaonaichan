import { useEffect, useRef, useState } from 'react';
import Badge from '../../components/ui/badge/Badge';
import { Modal } from '../../components/ui/modal';
import { searchProductsForImport, getProductVariations, saveBarcodeImport } from '../../services/jaonaichan';
import type { ProductSearchResult, ProductVariation } from '../../interfaces/barcode.jaonaichan';

const SCANNER_ELEMENT_ID = 'barcode-import-reader';

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
    barcode?: string;
    message?: string;
}

export default function BarcodeImport() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searching, setSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
    const [barcodeCount, setBarcodeCount] = useState(0);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [sessionBarcodes, setSessionBarcodes] = useState<string[]>([]);
    const [variations, setVariations] = useState<ProductVariation[]>([]);
    const [loadingVariations, setLoadingVariations] = useState(false);
    const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

    const hasInitialized = useRef(false);
    const scannerRef = useRef<Html5QrcodeInstance | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedProductRef = useRef<ProductSearchResult | null>(null);
    const selectedVariationRef = useRef<ProductVariation | null>(null);

    // Keep refs in sync so camera callbacks can read current values without stale closures
    useEffect(() => {
        selectedProductRef.current = selectedProduct;
    }, [selectedProduct]);

    useEffect(() => {
        selectedVariationRef.current = selectedVariation;
    }, [selectedVariation]);

    // Inject Html5Qrcode CDN script once on mount
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        if (document.getElementById('html5qrcode-script')) return;
        const script = document.createElement('script');
        script.id = 'html5qrcode-script';
        script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        document.body.appendChild(script);
    }, []);

    // Clear debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Camera lifecycle — start when cameraOpen becomes true, stop on false/unmount
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
                        try { await capturedScanner.stop(); } catch { /* already stopped */ }
                        scannerRef.current = null;
                        setCameraOpen(false);

                        const product = selectedProductRef.current;
                        if (!product) return;
                        const targetId = selectedVariationRef.current?.variation_id ?? product.product_id;

                        setSaving(true);
                        try {
                            const res = await saveBarcodeImport(targetId, barcode);
                            if (res.success) {
                                setScanResult({ ok: true, barcode });
                                const newCount = res.barcode_count;
                                if (newCount !== undefined) {
                                    setBarcodeCount(newCount);
                                    const vid = selectedVariationRef.current?.variation_id;
                                    if (vid !== undefined) {
                                        setVariations((prev) =>
                                            prev.map((v) =>
                                                v.variation_id === vid ? { ...v, barcode_count: newCount } : v
                                            )
                                        );
                                    }
                                } else {
                                    setBarcodeCount((c) => c + 1);
                                }
                                setSessionBarcodes((prev) => [...prev, barcode]);
                            } else {
                                setScanResult({ ok: false, message: res.message });
                            }
                        } catch {
                            setScanResult({ ok: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
                        } finally {
                            setSaving(false);
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

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);
        setSelectedProduct(null);
        setVariations([]);
        setSelectedVariation(null);
        setShowDropdown(false);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!q.trim()) {
            setSearchResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await searchProductsForImport(q.trim());
                setSearchResults(res.products);
                setShowDropdown(res.products.length > 0);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
    };

    const handleSelectProduct = async (product: ProductSearchResult) => {
        setSelectedProduct(product);
        setBarcodeCount(product.barcode_count);
        setSearchQuery(product.name);
        setShowDropdown(false);
        setScanResult(null);
        setVariations([]);
        setSelectedVariation(null);
        setSessionBarcodes([]);

        if (product.type === 'variable') {
            setLoadingVariations(true);
            try {
                const res = await getProductVariations(product.product_id);
                setVariations(res.variations);
            } catch {
                // variations will stay empty
            } finally {
                setLoadingVariations(false);
            }
        }
    };

    const handleOpenCamera = () => {
        setScanResult(null);
        setCameraOpen(true);
    };

    const isHttps = window.location.protocol === 'https:';

    return (
        <div className="mx-auto max-w-lg space-y-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                นำ Barcode เข้า
            </h1>

            {/* HTTPS warning */}
            {!isHttps && (
                <div className="rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
                    Camera access requires HTTPS. Barcode scanning may not work on this connection.
                </div>
            )}

            {/* Product search */}
            <div className="relative" ref={dropdownRef}>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInput}
                        placeholder="ค้นหาสินค้าด้วยชื่อ หรือ SKU"
                        className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:placeholder-gray-500"
                    />
                    {searching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            กำลังค้นหา…
                        </span>
                    )}
                </div>

                {/* Results dropdown */}
                {showDropdown && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {searchResults.map((p) => (
                            <button
                                key={p.product_id}
                                type="button"
                                onMouseDown={() => void handleSelectProduct(p)}
                                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                                    {p.name}
                                    {p.type === 'variable' && (
                                        <span className="ml-2 text-xs font-normal text-gray-400">(มี variation)</span>
                                    )}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ID: {p.product_id} · SKU: {p.sku} · Barcode: {p.barcode_count}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected product card */}
            {selectedProduct && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                        {selectedProduct.name}
                    </p>
                    {selectedProduct.sku && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            SKU: {selectedProduct.sku}
                        </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Badge color="light" size="sm">
                            ID: {selectedProduct.product_id}
                        </Badge>
                        {selectedVariation && (
                            <Badge color="light" size="sm">
                                Variation ID: {selectedVariation.variation_id}
                            </Badge>
                        )}
                        <Badge color="info" size="sm">
                            Barcode ทั้งหมด: {barcodeCount}
                        </Badge>
                    </div>
                </div>
            )}

            {/* Variation selector */}
            {selectedProduct?.type === 'variable' && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        เลือก Variation
                    </p>
                    {loadingVariations ? (
                        <p className="text-xs text-gray-400">กำลังโหลด…</p>
                    ) : variations.length === 0 ? (
                        <p className="text-xs text-gray-400">ไม่พบ variation</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {variations.map((v) => (
                                <button
                                    key={v.variation_id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedVariation(v);
                                        setBarcodeCount(v.barcode_count);
                                        setScanResult(null);
                                        setSessionBarcodes([]);
                                    }}
                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                        selectedVariation?.variation_id === v.variation_id
                                            ? 'bg-brand-500 text-white'
                                            : 'bg-gray-50 text-gray-800 hover:bg-gray-100 dark:bg-gray-700 dark:text-white/90 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    <span>{v.name}</span>
                                    <span className={`text-xs ${selectedVariation?.variation_id === v.variation_id ? 'text-white/70' : 'text-gray-400'}`}>
                                        Barcode: {v.barcode_count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Scan zone */}
            {selectedProduct && (selectedProduct.type === 'simple' || selectedVariation) && (
                <div className="space-y-3">
                    {/* Scan result feedback */}
                    {scanResult && (
                        <div className={`flex items-start gap-3 rounded-xl p-4 ${
                            scanResult.ok
                                ? 'border border-success-300 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10'
                                : 'border border-error-300 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10'
                        }`}>
                            <span className="text-lg leading-none">{scanResult.ok ? '✅' : '❌'}</span>
                            <p className={`text-sm font-medium ${
                                scanResult.ok
                                    ? 'text-success-700 dark:text-success-400'
                                    : 'text-error-700 dark:text-error-400'
                            }`}>
                                {scanResult.ok
                                    ? `บันทึกสำเร็จ: ${scanResult.barcode}`
                                    : (scanResult.message ?? 'เกิดข้อผิดพลาด')}
                            </p>
                        </div>
                    )}

                    {/* Open / Scan-again button */}
                    {!cameraOpen && !saving && (
                        <button
                            type="button"
                            onClick={handleOpenCamera}
                            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 font-medium text-white hover:bg-brand-600"
                        >
                            {scanResult ? 'Scan ต่อ' : 'เปิดกล้อง'}
                        </button>
                    )}

                    {saving && (
                        <div className="flex h-12 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                            กำลังบันทึก…
                        </div>
                    )}
                </div>
            )}

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
                        ยกเลิก
                    </button>
                </div>
            </Modal>

            {/* Session barcode list */}
            {sessionBarcodes.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                            Barcode ที่ scan ในรอบนี้
                        </h2>
                        <Badge color="primary" size="sm">
                            {sessionBarcodes.length} รายการ
                        </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sessionBarcodes.map((bc, i) => (
                            <Badge key={`${bc}-${i}`} color="light" size="sm">
                                {bc}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
