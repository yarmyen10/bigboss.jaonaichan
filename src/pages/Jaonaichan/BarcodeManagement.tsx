import { useEffect, useState, useCallback, useRef } from 'react';
import Badge from '../../components/ui/badge/Badge';
import { Modal } from '../../components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/table';
import { getBarcodes, deleteBarcode, searchProductsForImport, getProductVariations } from '../../services/jaonaichan';
import type { BarcodeRecord, ProductSearchResult, ProductVariation } from '../../interfaces/barcode.jaonaichan';

export default function BarcodeManagement() {
    const [barcodes, setBarcodes] = useState<BarcodeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Product Filter States
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [showVariationDropdown, setShowVariationDropdown] = useState(false);
    const [searchingProduct, setSearchingProduct] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
    const [variations, setVariations] = useState<ProductVariation[]>([]);
    const [loadingVariations, setLoadingVariations] = useState(false);
    const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

    const effectiveProductId = selectedProduct?.type === 'simple' 
        ? selectedProduct.product_id 
        : (selectedVariation?.variation_id ?? undefined);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    const fetchBarcodes = useCallback(async (p: number, search: string, productId?: number) => {
        setLoading(true);
        try {
            const res = await getBarcodes(p, 20, search, productId);
            setBarcodes(res.barcodes);
            setTotalPages(res.total_pages);
            setTotalItems(res.total);
            setPage(p);
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBarcodes(1, '', undefined);
    }, [fetchBarcodes]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
                setShowProductDropdown(false);
                setShowVariationDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            fetchBarcodes(1, q.trim(), effectiveProductId);
        }, 400);
    };

    const handleProductSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setProductSearchQuery(q);
        
        if (selectedProduct) {
            setSelectedProduct(null);
            setVariations([]);
            setSelectedVariation(null);
            fetchBarcodes(1, searchQuery.trim(), undefined);
        }

        setShowProductDropdown(false);

        if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
        if (!q.trim()) {
            setProductSearchResults([]);
            return;
        }

        productDebounceRef.current = setTimeout(async () => {
            setSearchingProduct(true);
            try {
                const res = await searchProductsForImport(q.trim());
                setProductSearchResults(res.products);
                setShowProductDropdown(res.products.length > 0);
            } catch {
                setProductSearchResults([]);
            } finally {
                setSearchingProduct(false);
            }
        }, 400);
    };

    const handleSelectProduct = async (product: ProductSearchResult) => {
        setSelectedProduct(product);
        setProductSearchQuery(product.name);
        setShowProductDropdown(false);
        setVariations([]);
        setSelectedVariation(null);

        if (product.type === 'variable') {
            setShowVariationDropdown(true);
            setLoadingVariations(true);
            try {
                const res = await getProductVariations(product.product_id);
                setVariations(res.variations);
            } catch {
                // variations will stay empty
            } finally {
                setLoadingVariations(false);
            }
        } else {
            fetchBarcodes(1, searchQuery.trim(), product.product_id);
        }
    };

    const handleSelectVariation = (v: ProductVariation) => {
        setSelectedVariation(v);
        if (selectedProduct) {
            setProductSearchQuery(`${selectedProduct.name} - ${v.name}`);
        }
        setShowVariationDropdown(false);
        fetchBarcodes(1, searchQuery.trim(), v.variation_id);
    };

    const clearProductFilter = () => {
        setProductSearchQuery('');
        setSelectedProduct(null);
        setVariations([]);
        setSelectedVariation(null);
        setShowVariationDropdown(false);
        fetchBarcodes(1, searchQuery.trim(), undefined);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchBarcodes(newPage, searchQuery.trim(), effectiveProductId);
        }
    };

    const confirmDelete = (id: number) => {
        setDeletingId(id);
        setDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setIsDeleting(true);
        try {
            const res = await deleteBarcode(deletingId);
            if (res.success) {
                // Refresh list
                fetchBarcodes(page, searchQuery.trim(), effectiveProductId);
            } else {
                alert(res.message || 'Failed to delete barcode');
            }
        } catch (error) {
            console.error('Failed to delete barcode:', error);
            alert('เกิดข้อผิดพลาดในการลบ Barcode');
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setDeletingId(null);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                    จัดการข้อมูล Barcode
                </h1>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        ทั้งหมด {totalItems} รายการ
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start z-10 relative">
                {/* Barcode Search */}
                <div className="relative w-full sm:max-w-xs">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInput}
                        placeholder="ค้นหาด้วย Barcode"
                        className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:placeholder-gray-500"
                    />
                </div>

                {/* Product Search */}
                <div className="relative w-full sm:max-w-md flex-1" ref={productDropdownRef}>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={productSearchQuery}
                            onChange={handleProductSearchInput}
                            onClick={() => {
                                if (selectedProduct?.type === 'variable') {
                                    setShowVariationDropdown(true);
                                } else if (!selectedProduct && productSearchResults.length > 0) {
                                    setShowProductDropdown(true);
                                }
                            }}
                            placeholder="กรองด้วยสินค้า (ชื่อ/SKU)"
                            className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pr-10 text-base text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:placeholder-gray-500"
                        />
                        {searchingProduct && (
                            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                กำลังค้นหา…
                            </span>
                        )}
                        {selectedProduct && (
                            <button 
                                onClick={clearProductFilter}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                                title="ล้างตัวกรองสินค้า"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                    
                    {/* Results dropdown */}
                    <div 
                        className={`absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ease-out origin-top ${
                            showProductDropdown ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                        }`}
                    >
                        {productSearchResults.map((p) => (
                            <button
                                key={p.product_id}
                                type="button"
                                onMouseDown={() => void handleSelectProduct(p)}
                                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                                    {p.name}
                                    {p.type === 'variable' && (
                                        <span className="ml-2 text-xs font-normal text-gray-400">(มี variation)</span>
                                    )}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ID: {p.product_id} · SKU: {p.sku}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Variation selector */}
                    {selectedProduct?.type === 'variable' && (
                        <div 
                            className={`absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ease-out origin-top ${
                                showVariationDropdown ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                            }`}
                        >
                            <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                กรุณาเลือก Variation เพื่อกรองข้อมูล
                            </p>
                            {loadingVariations ? (
                                <p className="text-xs text-gray-400">กำลังโหลด…</p>
                            ) : variations.length === 0 ? (
                                <p className="text-xs text-gray-400">ไม่พบ variation</p>
                            ) : (
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {variations.map((v) => (
                                        <button
                                            key={v.variation_id}
                                            type="button"
                                            onClick={() => handleSelectVariation(v)}
                                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                selectedVariation?.variation_id === v.variation_id
                                                    ? 'bg-brand-500 text-white shadow-sm'
                                                    : 'bg-gray-50 text-gray-800 hover:bg-gray-100 dark:bg-gray-700 dark:text-white/90 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            <span>{v.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-700/50">
                            <TableRow>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">ID</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">รูปภาพ</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Barcode</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Product</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Created At</TableCell>
                                <TableCell isHeader className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        กำลังโหลดข้อมูล...
                                    </TableCell>
                                </TableRow>
                            ) : barcodes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        ไม่พบข้อมูล Barcode
                                    </TableCell>
                                </TableRow>
                            ) : (
                                barcodes.map((bc) => (
                                    <TableRow key={bc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                                            #{bc.id}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 w-24">
                                            {bc.image_base64 ? (
                                                <img 
                                                    src={bc.image_base64} 
                                                    alt="barcode" 
                                                    className="h-10 w-16 rounded object-cover shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity" 
                                                    onClick={() => {
                                                        setSelectedImage(bc.image_base64!);
                                                        setImageModalOpen(true);
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex h-10 w-16 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400 dark:bg-gray-700">ไม่มีรูป</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                            {bc.barcode}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {bc.product_name}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-sm">
                                            <Badge color={bc.status === 'available' ? 'success' : bc.status === 'packed' ? 'primary' : 'light'} size="sm">
                                                {bc.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(bc.created_at).toLocaleString('th-TH')}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                            {bc.status === 'available' ? (
                                                <button
                                                    onClick={() => confirmDelete(bc.id)}
                                                    className="text-error-600 hover:text-error-900 dark:text-error-400 dark:hover:text-error-300 transition-colors"
                                                >
                                                    ลบ
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 cursor-not-allowed" title="ไม่สามารถลบ Barcode ที่แพ็คแล้วได้">
                                                    ลบ
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-800 rounded-b-xl">
                    <div className="flex flex-1 justify-between sm:hidden">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === totalPages}
                            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                        >
                            ถัดไป
                        </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                กำลังแสดง <span className="font-medium">{barcodes.length > 0 ? (page - 1) * 20 + 1 : 0}</span> ถึง <span className="font-medium">{(page - 1) * 20 + barcodes.length}</span> จากทั้งหมด <span className="font-medium">{totalItems}</span> รายการ
                            </p>
                        </div>
                        {totalPages > 1 && (
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page === 1}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-600 dark:hover:bg-gray-700"
                                    >
                                        <span className="sr-only">ก่อนหน้า</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {/* Simplistic pagination for now: just prev/next */}
                                    <button
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page === totalPages}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-600 dark:hover:bg-gray-700"
                                    >
                                        <span className="sr-only">ถัดไป</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </nav>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => !isDeleting && setDeleteModalOpen(false)}
                className="max-w-sm mx-4"
            >
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        ยืนยันการลบ Barcode
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        คุณต้องการลบ Barcode นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setDeleteModalOpen(false)}
                            disabled={isDeleting}
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="rounded-xl bg-error-600 px-4 py-2 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
                        >
                            {isDeleting ? 'กำลังลบ...' : 'ลบ'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Image Preview Modal */}
            <Modal
                isOpen={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                className="max-w-3xl mx-4 bg-transparent shadow-none border-none dark:bg-transparent"
            >
                <div className="flex flex-col items-center justify-center p-4">
                    {selectedImage && (
                        <img 
                            src={selectedImage} 
                            alt="Full Preview" 
                            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl ring-1 ring-white/10" 
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setImageModalOpen(false)}
                        className="mt-6 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-md hover:bg-white/20 transition-all border border-white/20"
                    >
                        ปิดรูปภาพ
                    </button>
                </div>
            </Modal>
        </div>
    );
}
