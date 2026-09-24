import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../../components/ui/modal';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import {
    getImportProducts,
    saveBarcodeImport,
    setImportOrderQty,
    updateImportBarcodeQty,
    removeImportBarcode,
} from '../../services/jaonaichan';
import type { ImportBarcode, ImportProduct, ImportVariant } from '../../interfaces/barcode.jaonaichan';

const SCANNER_ID = 'barcode-import-reader';

// ─── helpers ─────────────────────────────────────────────────────────────────

function sumReceived(barcodes: ImportBarcode[]) {
    return barcodes.reduce((s, b) => s + b.received_qty, 0);
}

function productReceived(p: ImportProduct) {
    return p.type === 'simple'
        ? sumReceived(p.barcodes)
        : p.variants.reduce((s, v) => s + sumReceived(v.barcodes), 0);
}

function productOrderQty(p: ImportProduct) {
    return p.type === 'simple'
        ? p.order_qty
        : p.variants.reduce((s, v) => s + v.order_qty, 0);
}

type Status = 'none' | 'incomplete' | 'complete' | 'over';
function getStatus(received: number, orderQty: number): Status {
    if (received === 0) return 'none';
    if (orderQty === 0 || received < orderQty) return 'incomplete';
    if (received === orderQty) return 'complete';
    return 'over';
}

function productLastScan(p: ImportProduct) {
    const dates = p.type === 'simple'
        ? p.barcodes.map(b => b.last_scan_at)
        : p.variants.flatMap(v => v.barcodes.map(b => b.last_scan_at));
    const sorted = dates.sort();
    return sorted[sorted.length - 1] ?? '';
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, received, orderQty }: { status: Status; received: number; orderQty: number }) {
    if (status === 'none') return <Badge color="error" size="sm">⚠ ไม่มี barcode</Badge>;
    if (status === 'incomplete') return <Badge color="warning" size="sm">📦 {received}/{orderQty}</Badge>;
    if (status === 'complete') return <Badge color="success" size="sm">✓ {received}/{orderQty}</Badge>;
    return <Badge color="amber" size="sm">⇧ {received}/{orderQty} (+{received - orderQty})</Badge>;
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ received, orderQty }: { received: number; orderQty: number }) {
    if (orderQty === 0) return null;
    const pct = Math.min(100, (received / orderQty) * 100);
    const color = received > orderQty ? 'bg-violet-500' : received === orderQty ? 'bg-green-500' : 'bg-amber-400';
    return (
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 mt-1.5">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

// ─── ProductCard (grid) ───────────────────────────────────────────────────────

function ProductCard({ p, onEdit }: { p: ImportProduct; onEdit: () => void }) {
    const received = productReceived(p);
    const orderQty = productOrderQty(p);
    const status = getStatus(received, orderQty);
    return (
        <button
            type="button"
            onClick={onEdit}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-all hover:border-brand-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
            <div className="aspect-square w-full overflow-hidden bg-gray-50 dark:bg-gray-700">
                {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl">🛍</div>
                )}
            </div>
            <div className="flex flex-1 flex-col p-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {p.type === 'variable' ? `${p.variants.length} รสชาติ` : (p.sku || '—')}
                </p>
                <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-gray-800 dark:text-white/90 mt-1">{p.name}</p>
                <div className="mt-auto flex flex-col gap-1 pt-2">
                    <StatusBadge status={status} received={received} orderQty={orderQty} />
                    {status !== 'none' && <ProgressBar received={received} orderQty={orderQty} />}
                </div>
            </div>
        </button>
    );
}

// ─── ProductRow (list) ────────────────────────────────────────────────────────

function ProductRow({ p, onEdit }: { p: ImportProduct; onEdit: () => void }) {
    const received = productReceived(p);
    const orderQty = productOrderQty(p);
    const status = getStatus(received, orderQty);
    return (
        <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-brand-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-700">
                {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🛍</div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {p.type === 'variable' ? `${p.variants.length} รสชาติ` : p.sku}
                </p>
                <p className="truncate text-sm font-semibold leading-tight text-gray-800 dark:text-white/90">{p.name}</p>
                <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={status} received={received} orderQty={orderQty} />
                    {status !== 'none' && <div className="flex-1"><ProgressBar received={received} orderQty={orderQty} /></div>}
                </div>
            </div>
            <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ initial, onClose, onSaved }: {
    initial: ImportProduct;
    onClose: () => void;
    onSaved: (updated: ImportProduct) => void;
}) {
    const [product, setProduct] = useState<ImportProduct>(initial);
    const [activeVariantIdx, setActiveVariantIdx] = useState(0);
    const [scanInput, setScanInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [savingQty, setSavingQty] = useState(false);
    const [qtyDraft, setQtyDraft] = useState(0);
    const [continuous, setContinuous] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const scanInputRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const qtyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);

    // refs for camera callback (avoid stale closures)
    const productRef = useRef(product);
    const activeVariantIdxRef = useRef(activeVariantIdx);
    const continuousRef = useRef(continuous);
    useEffect(() => { productRef.current = product; }, [product]);
    useEffect(() => { activeVariantIdxRef.current = activeVariantIdx; }, [activeVariantIdx]);
    useEffect(() => { continuousRef.current = continuous; }, [continuous]);

    // derived for current tab
    const isVariable = product.type === 'variable';
    const activeVariant: ImportVariant | null = isVariable ? (product.variants[activeVariantIdx] ?? null) : null;
    const currentBarcodes = activeVariant ? activeVariant.barcodes : product.barcodes;
    const currentOrderQty = activeVariant ? activeVariant.order_qty : product.order_qty;
    const currentReceived = sumReceived(currentBarcodes);
    const currentStatus = getStatus(currentReceived, currentOrderQty);

    // sync qty draft when switching tabs
    useEffect(() => {
        setQtyDraft(currentOrderQty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVariantIdx]);

    // auto-focus scan input
    useEffect(() => {
        const t = setTimeout(() => scanInputRef.current?.focus(), 300);
        return () => clearTimeout(t);
    }, []);

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (qtyDebounceRef.current) clearTimeout(qtyDebounceRef.current);
        };
    }, []);

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 2500);
    };

    const handleClose = () => {
        onSaved(productRef.current);
        onClose();
    };

    // ── scan ──────────────────────────────────────────────────────────────────

    async function handleScan(barcode: string) {
        const trimmed = barcode.trim();
        if (!trimmed || savingRef.current) return;

        const p = productRef.current;
        const vi = activeVariantIdxRef.current;
        const isVar = p.type === 'variable';
        const tid = isVar ? p.variants[vi].variant_id : p.product_id;
        const barcodes = isVar ? p.variants[vi].barcodes : p.barcodes;
        const orderQty = isVar ? p.variants[vi].order_qty : p.order_qty;

        savingRef.current = true;
        setSaving(true);
        try {
            const res = await saveBarcodeImport(tid, trimmed);
            if (res.success) {
                const existing = barcodes.find(b => b.code === trimmed);
                const newBarcodes: ImportBarcode[] = existing
                    ? barcodes.map(b => b.code === trimmed
                        ? { ...b, received_qty: b.received_qty + 1, last_scan_at: new Date().toISOString() }
                        : b)
                    : [...barcodes, { code: trimmed, received_qty: 1, last_scan_at: new Date().toISOString() }];

                setProduct(prev => isVar
                    ? { ...prev, variants: prev.variants.map((v, i) => i === vi ? { ...v, barcodes: newBarcodes } : v) }
                    : { ...prev, barcodes: newBarcodes }
                );

                const newTotal = sumReceived(newBarcodes);
                showToast(`รวม ${newTotal} ชิ้น${orderQty > 0 ? ` · เหลือ ${Math.max(0, orderQty - newTotal)}` : ''}`, true);
                setScanInput('');
                if (continuousRef.current) setTimeout(() => scanInputRef.current?.focus(), 50);
            } else {
                showToast(res.message ?? 'เกิดข้อผิดพลาด', false);
            }
        } catch {
            showToast('เกิดข้อผิดพลาด', false);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    // ── order qty ─────────────────────────────────────────────────────────────

    function handleQtyChange(val: number) {
        if (val < 0) return;
        setQtyDraft(val);

        const p = productRef.current;
        const vi = activeVariantIdxRef.current;
        const isVar = p.type === 'variable';
        setProduct(prev => isVar
            ? { ...prev, variants: prev.variants.map((v, i) => i === vi ? { ...v, order_qty: val } : v) }
            : { ...prev, order_qty: val }
        );

        if (qtyDebounceRef.current) clearTimeout(qtyDebounceRef.current);
        qtyDebounceRef.current = setTimeout(async () => {
            const lp = productRef.current;
            const lvi = activeVariantIdxRef.current;
            const latIsVar = lp.type === 'variable';
            const latTid = latIsVar ? lp.variants[lvi].variant_id : lp.product_id;
            setSavingQty(true);
            try { await setImportOrderQty(latTid, val); } catch { /* silent */ }
            finally { setSavingQty(false); }
        }, 600);
    }

    // ── barcode list actions ──────────────────────────────────────────────────

    async function handleUpdateQty(code: string, qty: number) {
        if (qty < 1) return;
        const p = productRef.current;
        const vi = activeVariantIdxRef.current;
        const isVar = p.type === 'variable';
        const tid = isVar ? p.variants[vi].variant_id : p.product_id;
        try {
            await updateImportBarcodeQty(tid, code, qty);
            setProduct(prev => {
                const update = (b: ImportBarcode[]) => b.map(x => x.code === code ? { ...x, received_qty: qty } : x);
                return isVar
                    ? { ...prev, variants: prev.variants.map((v, i) => i === vi ? { ...v, barcodes: update(v.barcodes) } : v) }
                    : { ...prev, barcodes: update(prev.barcodes) };
            });
        } catch { /* silent */ }
    }

    async function handleRemoveBarcode(code: string) {
        const p = productRef.current;
        const vi = activeVariantIdxRef.current;
        const isVar = p.type === 'variable';
        const tid = isVar ? p.variants[vi].variant_id : p.product_id;
        try {
            await removeImportBarcode(tid, code);
            setProduct(prev => {
                const update = (b: ImportBarcode[]) => b.filter(x => x.code !== code);
                return isVar
                    ? { ...prev, variants: prev.variants.map((v, i) => i === vi ? { ...v, barcodes: update(v.barcodes) } : v) }
                    : { ...prev, barcodes: update(prev.barcodes) };
            });
        } catch { /* silent */ }
    }

    // ── camera ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!cameraOpen) return;
        let stopped = false;
        const timer = setTimeout(async () => {
            try {
                const scanner = new Html5Qrcode(SCANNER_ID);
                scannerRef.current = scanner;
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 280, height: 150 } },
                    async (barcode) => {
                        if (stopped) return;
                        stopped = true;
                        try { await scanner.stop(); } catch { /* ok */ }
                        scannerRef.current = null;
                        setCameraOpen(false);
                        await handleScan(barcode);
                    },
                    () => { /* per-frame error, ignored */ }
                );
            } catch { setCameraOpen(false); }
        }, 150);
        return () => {
            clearTimeout(timer);
            if (scannerRef.current && !stopped) {
                stopped = true;
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraOpen]);

    // ── render ────────────────────────────────────────────────────────────────

    const overallReceived = productReceived(product);
    const overallOrderQty = productOrderQty(product);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 hidden bg-black/40 sm:block"
                onClick={handleClose}
            />

            {/* Panel — full-screen mobile, centered sm+ */}
            <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center sm:p-4">
                <div className="relative flex h-full w-full flex-col bg-white dark:bg-gray-900 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:overflow-hidden">

                    {/* Header */}
                    <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700">
                            {product.image_url
                                ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                : <div className="flex h-full items-center justify-center text-2xl">🛍</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                            {isVariable && <p className="text-xs text-gray-500">{product.variants.length} รสชาติ</p>}
                            <p className="truncate font-semibold text-gray-800 dark:text-white/90">{product.name}</p>
                            {product.sku && <p className="text-xs text-gray-400">SKU: {product.sku}</p>}
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M18 6 6 18M6 6l12 12" strokeWidth={2} strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Overall progress — variable only */}
                    {isVariable && (
                        <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                            <span className="shrink-0 text-xs text-gray-500">รวมทุกรสชาติ</span>
                            <div className="flex-1"><ProgressBar received={overallReceived} orderQty={overallOrderQty} /></div>
                            <span className="shrink-0 text-sm font-bold text-gray-800 dark:text-white">{overallReceived}/{overallOrderQty}</span>
                        </div>
                    )}

                    {/* Variant tabs */}
                    {isVariable && (
                        <div
                            className="flex flex-shrink-0 gap-0 overflow-x-auto border-b border-gray-200 bg-gray-50 px-2 dark:border-gray-700 dark:bg-gray-800/50"
                            style={{ scrollbarWidth: 'none' }}
                        >
                            {product.variants.map((v, i) => {
                                const vr = sumReceived(v.barcodes);
                                const vs = getStatus(vr, v.order_qty);
                                return (
                                    <button
                                        key={v.variant_id}
                                        type="button"
                                        onClick={() => setActiveVariantIdx(i)}
                                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                                            i === activeVariantIdx
                                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        {v.name}
                                        <StatusBadge status={vs} received={vr} orderQty={v.order_qty} />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Scrollable body — 1-col mobile, 2-col sm+ */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">

                            {/* Left: order qty + progress */}
                            <div className="space-y-3">
                                {/* Order qty */}
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        จำนวนที่สั่งซื้อ {savingQty && <span className="ml-1 font-normal normal-case">บันทึก…</span>}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleQtyChange(Math.max(0, qtyDraft - 1))}
                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                        >−</button>
                                        <input
                                            type="number"
                                            min={0}
                                            value={qtyDraft}
                                            onChange={e => handleQtyChange(parseInt(e.target.value) || 0)}
                                            className="h-9 w-20 rounded-lg border border-gray-300 bg-white text-center text-lg font-bold text-gray-800 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleQtyChange(qtyDraft + 1)}
                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                        >+</button>
                                        <span className="text-sm text-gray-500">ชิ้น</span>
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">สรุปการรับ</p>
                                    <div className="mb-2 flex items-baseline justify-between">
                                        <div>
                                            <span className="text-3xl font-extrabold text-gray-800 dark:text-white">{currentReceived}</span>
                                            <span className="text-lg text-gray-400"> / {currentOrderQty}</span>
                                        </div>
                                        <StatusBadge status={currentStatus} received={currentReceived} orderQty={currentOrderQty} />
                                    </div>
                                    <ProgressBar received={currentReceived} orderQty={currentOrderQty} />
                                </div>
                            </div>

                            {/* Right: scan */}
                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">สแกนบาร์โค้ด</p>
                                    {/* Multi-scan toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setContinuous(c => !c)}
                                        title={continuous ? 'โหมดต่อเนื่อง' : 'โหมดทีละอัน'}
                                        className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors ${
                                            continuous
                                                ? 'bg-brand-500 text-white'
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 12h16M4 6h16M4 18h16" strokeWidth={2} />
                                        </svg>
                                        {continuous ? 'ต่อเนื่อง' : 'ทีละอัน'}
                                    </button>
                                </div>

                                {/* Scan input row */}
                                <div className="mb-3 flex gap-2">
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        value={scanInput}
                                        onChange={e => setScanInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') void handleScan(scanInput); }}
                                        placeholder="ยิงหรือพิมพ์ barcode…"
                                        disabled={saving}
                                        className="h-11 flex-1 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50/30 px-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 disabled:opacity-50 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setScanInput(''); setCameraOpen(true); }}
                                        title="เปิดกล้อง"
                                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeWidth={2} />
                                            <circle cx="12" cy="13" r="4" strokeWidth={2} />
                                        </svg>
                                    </button>
                                </div>

                                {saving && (
                                    <p className="mb-3 text-xs text-gray-400">กำลังบันทึก…</p>
                                )}

                                {/* Barcode list */}
                                {currentBarcodes.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                            สแกนแล้ว ({currentBarcodes.length} รายการ)
                                        </p>
                                        {currentBarcodes.map(b => (
                                            <div key={b.code} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5 dark:border-gray-700">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-mono text-sm font-semibold text-gray-800 dark:text-white">{b.code}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        {new Date(b.last_scan_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleUpdateQty(b.code, b.received_qty - 1)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                                    >−</button>
                                                    <span className="w-7 text-center text-sm font-bold text-gray-800 dark:text-white">{b.received_qty}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleUpdateQty(b.code, b.received_qty + 1)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                                    >+</button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleRemoveBarcode(b.code)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeWidth={2} strokeLinecap="round" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-gray-400 py-4">ยังไม่มี barcode</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Toast */}
                    {toast && (
                        <div className={`absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
                            <span>{toast.ok ? '✓' : '✗'}</span>
                            <span>{toast.msg}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Camera sub-modal */}
            <Modal isOpen={cameraOpen} onClose={() => setCameraOpen(false)} showCloseButton={false} className="max-w-sm mx-4">
                <div className="space-y-3 p-4">
                    <p className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">สแกน Barcode</p>
                    <div className="overflow-hidden rounded-xl">
                        <div id={SCANNER_ID} className="w-full" />
                    </div>
                    <Button variant="outline" onClick={() => setCameraOpen(false)} className="w-full">
                        ยกเลิก
                    </Button>
                </div>
            </Modal>
        </>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BarcodeImport() {
    const [products, setProducts] = useState<ImportProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Status | 'all' | 'no_order_qty'>('all');
    const [category, setCategory] = useState('');
    const [sort, setSort] = useState<'incomplete_first' | 'name' | 'recent'>('incomplete_first');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        try { return (localStorage.getItem('barcode-import-view') as 'grid' | 'list') ?? 'grid'; }
        catch { return 'grid'; }
    });
    const [editProduct, setEditProduct] = useState<ImportProduct | null>(null);

    useEffect(() => {
        getImportProducts()
            .then(res => setProducts(res.products))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const setView = (v: 'grid' | 'list') => {
        setViewMode(v);
        try { localStorage.setItem('barcode-import-view', v); } catch { /* ok */ }
    };

    const handleSaved = (updated: ImportProduct) => {
        setProducts(ps => ps.map(p => p.product_id === updated.product_id ? updated : p));
    };

    // derived
    const statusOf = (p: ImportProduct) => getStatus(productReceived(p), productOrderQty(p));
    const counts = {
        all: products.length,
        none: products.filter(p => statusOf(p) === 'none').length,
        incomplete: products.filter(p => statusOf(p) === 'incomplete').length,
        complete: products.filter(p => statusOf(p) === 'complete').length,
        over: products.filter(p => statusOf(p) === 'over').length,
        no_order_qty: products.filter(p => productOrderQty(p) === 0).length,
    };
    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

    const filtered = products
        .filter(p => {
            if (filter === 'no_order_qty') {
                if (productOrderQty(p) !== 0) return false;
            } else if (filter !== 'all' && statusOf(p) !== filter) {
                return false;
            }
            if (category && p.category !== category) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            if (sort === 'name') return a.name.localeCompare(b.name, 'th');
            if (sort === 'recent') return productLastScan(b).localeCompare(productLastScan(a));
            const ord: Record<Status, number> = { incomplete: 0, none: 1, over: 2, complete: 3 };
            return ord[statusOf(a)] - ord[statusOf(b)];
        });

    const chips: { key: Status | 'all' | 'no_order_qty'; label: string }[] = [
        { key: 'all', label: `ทั้งหมด · ${counts.all}` },
        { key: 'none', label: `⚠ ไม่มี barcode · ${counts.none}` },
        { key: 'incomplete', label: `📦 ไม่ครบ · ${counts.incomplete}` },
        { key: 'complete', label: `✓ ครบ · ${counts.complete}` },
        { key: 'over', label: `⇧ เกิน · ${counts.over}` },
        { key: 'no_order_qty', label: `🚫 ไม่มีจำนวนสั่งซื้อ · ${counts.no_order_qty}` },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-extrabold text-gray-800 dark:text-white/90">Barcode Import</h1>
                    <p className="text-sm text-gray-500">{products.length} สินค้า Active</p>
                </div>
                {/* Stats — md+ only */}
                <div className="hidden gap-2 md:flex">
                    {([
                        { label: 'ไม่มี barcode', val: counts.none, cls: 'text-red-600 dark:text-red-400' },
                        { label: 'ไม่ครบ', val: counts.incomplete, cls: 'text-amber-600 dark:text-amber-400' },
                        { label: 'ครบ', val: counts.complete, cls: 'text-green-600 dark:text-green-400' },
                        { label: 'เกิน', val: counts.over, cls: 'text-violet-600 dark:text-violet-400' },
                        { label: 'ไม่มีจำนวนสั่งซื้อ', val: counts.no_order_qty, cls: 'text-gray-600 dark:text-gray-400' },
                    ] as const).map(s => (
                        <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-[10px] text-gray-500">{s.label}</p>
                            <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[180px] flex-1">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ค้นหาชื่อ, SKU…"
                        className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent pl-9 pr-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                </div>
                {categories.length > 0 && (
                    <div className="relative z-20">
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="h-11 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        >
                            <option value="">หมวด: ทั้งหมด</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>
                )}
                <div className="relative z-20">
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as typeof sort)}
                        className="h-11 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    >
                        <option value="incomplete_first">ยังไม่ครบก่อน</option>
                        <option value="name">ชื่อ A→Z</option>
                        <option value="recent">อัปเดตล่าสุด</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                </div>
                {/* View toggle */}
                <div className="flex overflow-hidden rounded-lg ring-1 ring-gray-300 dark:ring-gray-700">
                    <button
                        type="button"
                        onClick={() => setView('grid')}
                        className={`flex h-11 w-11 items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400'}`}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('list')}
                        className={`flex h-11 w-11 items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400'}`}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                            <circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {chips.map(c => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setFilter(c.key)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            filter === c.key
                                ? 'border-brand-500 bg-brand-500 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-brand-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* Product list */}
            {loading ? (
                <div className="py-20 text-center text-sm text-gray-400">กำลังโหลด…</div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">ไม่พบสินค้า</div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {filtered.map(p => (
                        <ProductCard key={p.product_id} p={p} onEdit={() => setEditProduct(p)} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map(p => (
                        <ProductRow key={p.product_id} p={p} onEdit={() => setEditProduct(p)} />
                    ))}
                </div>
            )}

            {/* Edit modal */}
            {editProduct && (
                <EditModal
                    key={editProduct.product_id}
                    initial={editProduct}
                    onClose={() => setEditProduct(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
