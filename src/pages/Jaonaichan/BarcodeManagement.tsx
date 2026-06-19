import { useEffect, useState, useCallback, useRef } from 'react';
import Badge from '../../components/ui/badge/Badge';
import { Modal } from '../../components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/table';
import { getBarcodes, deleteBarcode } from '../../services/jaonaichan';
import type { BarcodeRecord } from '../../interfaces/barcode.jaonaichan';

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

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchBarcodes = useCallback(async (p: number, search: string) => {
        setLoading(true);
        try {
            const res = await getBarcodes(p, 20, search);
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
        fetchBarcodes(1, '');
    }, [fetchBarcodes]);

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            fetchBarcodes(1, q.trim());
        }, 400);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchBarcodes(newPage, searchQuery.trim());
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
                fetchBarcodes(page, searchQuery.trim());
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

            {/* Search */}
            <div className="relative max-w-md">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    placeholder="ค้นหาด้วย Barcode"
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:placeholder-gray-500"
                />
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-700/50">
                            <TableRow>
                                <TableCell isHeader className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">ID</TableCell>
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
                                    <TableCell colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        กำลังโหลดข้อมูล...
                                    </TableCell>
                                </TableRow>
                            ) : barcodes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        ไม่พบข้อมูล Barcode
                                    </TableCell>
                                </TableRow>
                            ) : (
                                barcodes.map((bc) => (
                                    <TableRow key={bc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                                            #{bc.id}
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
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
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
                                    หน้า <span className="font-medium">{page}</span> จาก <span className="font-medium">{totalPages}</span>
                                </p>
                            </div>
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
                        </div>
                    </div>
                )}
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
        </div>
    );
}
