import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CardFrame from "../../components/common/CardFrame";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import {
  Order as OrderIF,
  OrderItemProduct,
  OrderProductsBulkItem,
  OrderListResponse,
  OrderProductsBulkResponse,
} from "../../interfaces/order.jaonaichan";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import { AlertModal } from "../../components/ui/modal/AlertModal";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { useSpinner } from "../../hooks/useSpinner";
import PageSpinner from "../../components/common/PageSpinner";
import ProductDetailsCard from "../../components/jaonaichan/ProductDetailsCard";
import {
  getOrders,
  getProductsBulkByOrders,
  patchBill2,
  patchOrderStatus,
} from "../../services/jaonaichan";
import { CheckCircleIcon, EyeIcon } from "../../icons";

function generateBatchId(): string {
  const now = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function formatBatchDate(batchId: string): string {
  if (batchId.length < 12) return batchId;
  return `${batchId.slice(0, 4)}-${batchId.slice(4, 6)}-${batchId.slice(6, 8)} ${batchId.slice(8, 10)}:${batchId.slice(10, 12)}`;
}

interface BatchGroup {
  batchId: string | null;
  orders: OrderIF[];
}

const getProductColumns = (
  unitPrices: Record<number, string>,
  setUnitPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  onViewDetails: (product: OrderItemProduct) => void
): ColumnDef<OrderItemProduct>[] => [
  {
    key: "name",
    label: "Product",
    sortable: true,
    render: (val, row) => (
      <div className="flex items-center gap-3">
        <img
          src={row.image?.thumbnail ?? row.image?.medium ?? ""}
          alt={row.name}
          className="h-10 w-10 shrink-0 rounded object-cover bg-gray-100 dark:bg-gray-800"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-black dark:text-white">{val as string}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{row.sku}</p>
        </div>
      </div>
    ),
  },
  {
    key: "price",
    label: "ราคา",
    sortable: true,
    render: (val) => (
      <span className="font-semibold text-black dark:text-white">
        ฿{Number(val).toLocaleString()}
      </span>
    ),
  },
  {
    key: "stock",
    label: "Stock",
    sortable: true,
    render: (val, row) =>
      val !== null ? (
        <span className="text-sm text-gray-700 dark:text-gray-300">{val as number}</span>
      ) : (
        <Badge variant="light" color="light">
          {row.stock_status}
        </Badge>
      ),
  },
  {
    key: "unit_price",
    label: "Unit Price (Bill 2)",
    width: "160px",
    noExport: true,
    render: (_val, row) => {
      const value = unitPrices[row.id] ?? "";
      return (
        <div
          className="relative w-full min-w-[150px]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            ฿
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, "");
              const parts = raw.split(".");
              const next =
                parts.length > 1
                  ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
                  : raw;
              setUnitPrices((prev) => {
                if (next === "") {
                  const { [row.id]: _removed, ...rest } = prev;
                  return rest;
                }
                return { ...prev, [row.id]: next };
              });
            }}
            className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          />
        </div>
      );
    },
  },
  {
    key: "action",
    label: "",
    width: "48px",
    noExport: true,
    render: (_val, row) => (
      <button
        onClick={(e) => { e.stopPropagation(); onViewDetails(row); }}
        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
      </button>
    ),
  },
];

export default function Bill2UnitPrices() {
  const { spinning, withSpinner } = useSpinner(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);

  const [allOrders, setAllOrders] = useState<OrderIF[]>([]);
  const [bulkItems, setBulkItems] = useState<OrderProductsBulkItem[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [unitPrices, setUnitPrices] = useState<Record<number, string>>({});
  const [modalProduct, setModalProduct] = useState<OrderItemProduct | null>(null);

  const { isOpen: isConfirmOpen, openModal: openConfirm, closeModal: closeConfirm } = useModal();
  const { isOpen: isResultOpen, openModal: openResult, closeModal: closeResult } = useModal();
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();
  const [resultVariant, setResultVariant] = useState<"success" | "error">("success");
  const [resultMessage, setResultMessage] = useState("");

  const batches = useMemo<BatchGroup[]>(() => {
    const map = new Map<string, OrderIF[]>();
    for (const order of allOrders) {
      const key = order.bill2.unit_prices_id ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return b.localeCompare(a);
      })
      .map(([key, orders]) => ({ batchId: key || null, orders }));
  }, [allOrders]);

  const activeBatchOrders = useMemo(() => {
    const batch = batches.find((b) => (b.batchId ?? "") === (activeBatchId ?? ""));
    return batch?.orders ?? [];
  }, [batches, activeBatchId]);

  const uniqueProducts = useMemo(() => {
    const activeIds = new Set(activeBatchOrders.map((o) => o.id));
    const map = new Map<number, OrderItemProduct>();
    for (const item of bulkItems) {
      if (activeIds.has(item.id) && !map.has(item.product.id)) {
        map.set(item.product.id, item.product);
      }
    }
    return Array.from(map.values());
  }, [bulkItems, activeBatchOrders]);

  const orderTotals = useMemo(() => {
    const numericPrices: Record<number, number> = {};
    for (const [pid, raw] of Object.entries(unitPrices)) {
      const price = parseFloat(raw) || 0;
      if (price > 0) numericPrices[Number(pid)] = price;
    }
    const activeIds = new Set(activeBatchOrders.map((o) => o.id));
    const orderItemsMap = new Map<number, OrderProductsBulkItem[]>();
    for (const item of bulkItems) {
      if (!activeIds.has(item.id)) continue;
      if (!orderItemsMap.has(item.id)) orderItemsMap.set(item.id, []);
      orderItemsMap.get(item.id)!.push(item);
    }
    return Array.from(orderItemsMap.entries()).map(([orderId, items]) => {
      let total = 0;
      for (const item of items) total += (numericPrices[item.product.id] ?? 0) * item.quantity;
      const info = activeBatchOrders.find((o) => o.id === orderId);
      return {
        orderId,
        orderNumber: info?.number ?? String(orderId),
        customerName: info?.customer.name ?? "—",
        total,
        itemCount: items.length,
      };
    });
  }, [bulkItems, unitPrices, activeBatchOrders]);

  const pricedCount = Object.keys(unitPrices).length;
  const totalBill2 = orderTotals.reduce((s, o) => s + o.total, 0);
  const isNewBatch = activeBatchId === null;

  const handleViewDetails = useCallback((product: OrderItemProduct) => {
    setModalProduct(product);
    openDetails();
  }, [openDetails]);

  const productColumns = useMemo(
    () => getProductColumns(unitPrices, setUnitPrices, handleViewDetails),
    [unitPrices, handleViewDetails]
  );

  const applyBatchPrices = useCallback((batchId: string | null, orders: OrderIF[]) => {
    const batchOrders = orders.filter((o) => (o.bill2.unit_prices_id ?? null) === batchId);
    const merged: Record<number, string> = {};
    for (const order of batchOrders) {
      if (order.bill2.unit_prices) {
        for (const [pid, price] of Object.entries(order.bill2.unit_prices)) {
          merged[Number(pid)] = String(price);
        }
      }
    }
    setUnitPrices(merged);
  }, []);

  const handleBatchSelect = useCallback(
    (batchId: string | null) => {
      setActiveBatchId(batchId);
      applyBatchPrices(batchId, allOrders);
    },
    [allOrders, applyBatchPrices]
  );

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res: OrderListResponse = await getOrders({
        status: "paid-1,pending-payment-2",
        perPage: 100,
        createDateY: new Date().getFullYear(),
      });
      const orders = res?.data ?? [];
      setAllOrders(orders);

      if (orders.length > 0) {
        const bulkRes: OrderProductsBulkResponse = await getProductsBulkByOrders({
          orderIds: orders.map((o) => o.id),
          perPage: 100,
        });
        setBulkItems(bulkRes?.data ?? []);
      } else {
        setBulkItems([]);
      }

      const keySet = new Set(orders.map((o) => o.bill2.unit_prices_id ?? ""));
      const sortedKeys = Array.from(keySet).sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return b.localeCompare(a);
      });
      const firstKey = sortedKeys[0] ?? "";
      const firstBatchId = firstKey === "" ? null : firstKey;
      setActiveBatchId(firstBatchId);
      applyBatchPrices(firstBatchId, orders);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [applyBatchPrices]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadData();
  }, [loadData]);

  const handleSave = () => {
    withSpinner(async () => {
      try {
        const numericPrices: Record<number, number> = {};
        for (const [pid, raw] of Object.entries(unitPrices)) {
          const price = parseFloat(raw) || 0;
          if (price > 0) numericPrices[Number(pid)] = price;
        }

        const batchId = isNewBatch ? generateBatchId() : activeBatchId!;
        const activeIds = new Set(activeBatchOrders.map((o) => o.id));
        const orderItemsMap = new Map<number, OrderProductsBulkItem[]>();
        for (const item of bulkItems) {
          if (!activeIds.has(item.id)) continue;
          if (!orderItemsMap.has(item.id)) orderItemsMap.set(item.id, []);
          orderItemsMap.get(item.id)!.push(item);
        }

        await Promise.all(
          Array.from(orderItemsMap.entries()).map(async ([orderId, items]) => {
            const orderPrices: Record<number, number> = {};
            let total = 0;
            for (const item of items) {
              const price = numericPrices[item.product.id] ?? 0;
              if (price > 0) orderPrices[item.product.id] = price;
              total += price * item.quantity;
            }
            await patchBill2(orderId, total, "pending", undefined, orderPrices, batchId);
            if (isNewBatch) {
              await patchOrderStatus(orderId, "wc-pending-payment-2");
            }
          })
        );

        closeConfirm();
        setResultVariant("success");
        setResultMessage(
          `${isNewBatch ? "บันทึก" : "อัปเดต"}สำเร็จ! ${orderItemsMap.size} orders (Batch: ${batchId})`
        );
        openResult();
        await loadData();
      } catch (err) {
        closeConfirm();
        setResultVariant("error");
        setResultMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        openResult();
        console.error(err);
      }
    });
  };

  if (spinning) return <PageSpinner />;

  return (
    <>
      <PageMeta
        title="Bill 2 Unit Prices | Jaonaichan Admin"
        description="Manage Bill 2 unit prices grouped by batch"
      />
      <PageBreadcrumb pageTitle="Bill 2 Unit Prices" />

      {/* Batch selector */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          เลือกรอบ
        </p>
        {isLoading ? (
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ) : batches.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">ไม่มี Orders</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {batches.map((batch) => {
              const isActive = (batch.batchId ?? "") === (activeBatchId ?? "");
              return (
                <button
                  key={batch.batchId ?? "__new__"}
                  onClick={() => handleBatchSelect(batch.batchId)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {batch.batchId ? formatBatchDate(batch.batchId) : "ยังไม่ได้ตั้งราคา"}
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {batch.orders.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Products pricing table */}
        <div className="min-w-0 flex-1">
          <CardFrame isLoading={isLoading}>
            <DataTableOne<OrderItemProduct>
              title="Products"
              subtitle={
                activeBatchId
                  ? `Batch ${formatBatchDate(activeBatchId)} — ${activeBatchOrders.length} orders`
                  : `ยังไม่ได้ตั้งราคา — ${activeBatchOrders.length} orders`
              }
              columns={productColumns}
              data={uniqueProducts}
              rowKey="id"
              searchable="header"
              scrollable
              fillHeight
            />
          </CardFrame>
        </div>

        {/* Summary panel */}
        <div className="w-full shrink-0 lg:w-80 xl:w-96">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            {/* Stats */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/20">
                <p className="text-xs text-gray-500 dark:text-gray-400">Orders</p>
                <p className="text-xl font-bold text-brand-600 dark:text-brand-400">
                  {activeBatchOrders.length}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
                <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {uniqueProducts.length}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
                <p className="text-xs text-gray-500 dark:text-gray-400">Priced</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {pricedCount}/{uniqueProducts.length}
                </p>
              </div>
            </div>

            {/* Orders list */}
            <div className="mb-4">
              <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Orders ในรอบนี้
              </h6>
              {isLoading ? (
                <p className="py-6 text-center text-sm text-gray-400">Loading...</p>
              ) : orderTotals.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircleIcon className="mx-auto mb-2 size-8 text-emerald-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มี Orders ในรอบนี้</p>
                </div>
              ) : (
                <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-0.5 custom-scrollbar">
                  {orderTotals.map((o) => (
                    <div
                      key={o.orderId}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                          #{o.orderNumber}
                        </p>
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {o.customerName}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p
                          className={`text-sm font-semibold ${
                            o.total > 0
                              ? "text-brand-600 dark:text-brand-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          ฿{o.total.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">{o.itemCount} items</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grand total */}
            {orderTotals.length > 0 && (
              <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">รวม Bill 2 ทั้งหมด</p>
                  <p className="text-base font-bold text-gray-800 dark:text-white">
                    ฿{totalBill2.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Batch ID */}
            {activeBatchId && (
              <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                <p className="text-xs text-gray-400 dark:text-gray-500">Batch ID</p>
                <p className="font-mono text-xs text-gray-600 dark:text-gray-300">{activeBatchId}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button
                variant="primary"
                size="sm"
                onClick={openConfirm}
                disabled={pricedCount === 0 || activeBatchOrders.length === 0}
                className="w-full justify-center"
              >
                {isNewBatch
                  ? `บันทึก ${activeBatchOrders.length} Orders`
                  : `อัปเดตราคา ${activeBatchOrders.length} Orders`}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadData} className="flex-1 justify-center">
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyBatchPrices(activeBatchId, allOrders)}
                  className="flex-1 justify-center"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={closeDetails} className="max-w-md p-0 overflow-hidden">
        <div className="max-h-[85vh] overflow-y-auto">
          <ProductDetailsCard product={modalProduct} variant="flat" />
        </div>
      </Modal>

      {/* Confirm save */}
      <AlertModal
        isOpen={isConfirmOpen}
        onClose={closeConfirm}
        variant="info"
        title={isNewBatch ? "ยืนยันการบันทึก" : "ยืนยันการอัปเดต"}
        message={`${isNewBatch ? "บันทึก" : "อัปเดต"} Unit Prices สำหรับ ${activeBatchOrders.length} orders ใช่หรือไม่? รวม Bill 2: ฿${totalBill2.toLocaleString()}`}
        onConfirm={handleSave}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
      />

      {/* Result feedback */}
      <AlertModal
        isOpen={isResultOpen}
        onClose={closeResult}
        variant={resultVariant}
        message={resultMessage}
      />
    </>
  );
}
