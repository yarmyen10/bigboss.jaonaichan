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
  deleteBill2Batch,
} from "../../services/jaonaichan";
import { CheckCircleIcon, EyeIcon } from "../../icons";
import { roundUp, PreviewOrder, PreviewProductLine } from "../../hooks/jaonaichan/useManageProducts";
import BillPreviewTable from "../../components/jaonaichan/BillPreviewTable";

function generateBatchId(): string {
  const now = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function recordChanged(current: Record<number, string>, saved: Record<number, string>): boolean {
  const currentKeys = Object.keys(current).sort();
  const savedKeys = Object.keys(saved).sort();
  if (currentKeys.length !== savedKeys.length) return true;
  return currentKeys.some((k) => current[Number(k)] !== saved[Number(k)]);
}

function formatBatchDate(batchId: string): string {
  if (batchId.length < 12) return batchId;
  return `${batchId.slice(0, 4)}-${batchId.slice(4, 6)}-${batchId.slice(6, 8)} ${batchId.slice(8, 10)}:${batchId.slice(10, 12)}`;
}

interface BatchGroup {
  batchId: string | null;
  orders: OrderIF[];
}

const renderFeeInput = (
  value: string,
  setValue: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  rowId: number
) => (
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
      placeholder="0"
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const next = parts.length > 1
          ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
          : raw;
        setValue((prev) => {
          if (next === "") {
            const { [rowId]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [rowId]: next };
        });
      }}
      className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
    />
  </div>
);

const getProductColumns = (
  unitPrices: Record<number, string>,
  setUnitPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  chinaShippingPrices: Record<number, string>,
  setChinaShippingPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  importFeePrices: Record<number, string>,
  setImportFeePrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  extraShippingPrices: Record<number, string>,
  setExtraShippingPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
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
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {row.variation?.length
              ? `${row.sku} · ${row.variation.map((v) => v.value.replace(/<[^>]+>/g, "").trim()).join(" / ")}`
              : row.sku}
          </p>
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
    label: "Extra Items",
    width: "150px",
    noExport: true,
    render: (_val, row) => renderFeeInput(unitPrices[row.id] ?? "0", setUnitPrices, row.id),
  },
  {
    key: "extra_shipping",
    label: "Extra Shipping Fee",
    width: "150px",
    noExport: true,
    render: (_val, row) => renderFeeInput(extraShippingPrices[row.id] ?? "0", setExtraShippingPrices, row.id),
  },
  {
    key: "china_shipping",
    label: "China Shipping (Total)",
    width: "150px",
    noExport: true,
    render: (_val, row) => renderFeeInput(chinaShippingPrices[row.id] ?? "0", setChinaShippingPrices, row.id),
  },
  {
    key: "import_fee",
    label: "Import Fee (Total)",
    width: "150px",
    noExport: true,
    render: (_val, row) => renderFeeInput(importFeePrices[row.id] ?? "0", setImportFeePrices, row.id),
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
  const savedUnitPrices = useRef<Record<number, string>>({});
  const [chinaShippingPrices, setChinaShippingPrices] = useState<Record<number, string>>({});
  const savedChinaShippingPrices = useRef<Record<number, string>>({});
  const [importFeePrices, setImportFeePrices] = useState<Record<number, string>>({});
  const savedImportFeePrices = useRef<Record<number, string>>({});
  const [extraShippingPrices, setExtraShippingPrices] = useState<Record<number, string>>({});
  const savedExtraShippingPrices = useRef<Record<number, string>>({});
  const [localShippingPrice, setLocalShippingPrice] = useState<string>("");
  const [modalProduct, setModalProduct] = useState<OrderItemProduct | null>(null);

  const { isOpen: isConfirmOpen, openModal: openConfirm, closeModal: closeConfirm } = useModal();
  const { isOpen: isResultOpen, openModal: openResult, closeModal: closeResult } = useModal();
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();
  const { isOpen: isDeleteOpen, openModal: openDelete, closeModal: closeDelete } = useModal();
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
    const seen = new Set<number>();
    const result: OrderItemProduct[] = [];
    for (const item of bulkItems) {
      if (activeIds.has(item.id) && !seen.has(item.item_id)) {
        seen.add(item.item_id);
        // Use item_id as the product id so same-variation items with different
        // flavors/names are shown as separate rows in the pricing table.
        result.push({ ...item.product, id: item.item_id, name: item.name, variation: item.variation });
      }
    }
    return result;
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

    const useNewChina = Object.keys(chinaShippingPrices).length > 0;
    const useNewImport = Object.keys(importFeePrices).length > 0;
    const useNewExtra = Object.keys(extraShippingPrices).length > 0;
    const useNewLocal = localShippingPrice.trim() !== "";
    const parsedLocal = parseFloat(localShippingPrice) || 0;

    return Array.from(orderItemsMap.entries()).map(([orderId, items]) => {
      let total = 0;
      let orderChinaShipping = 0;
      let orderImportFee = 0;
      let orderExtraShipping = 0;

      for (const item of items) {
        // Price keyed by item_id so same-variation different-flavor items price independently
        total += roundUp((numericPrices[item.item_id] ?? 0) * item.quantity);
        if (useNewChina) orderChinaShipping += parseFloat(chinaShippingPrices[item.item_id]) || 0;
        if (useNewImport) orderImportFee += parseFloat(importFeePrices[item.item_id]) || 0;
        if (useNewExtra) orderExtraShipping += parseFloat(extraShippingPrices[item.item_id]) || 0;
      }
      const info = activeBatchOrders.find((o) => o.id === orderId);

      if (!useNewChina) orderChinaShipping = info?.bill2?.china_shipping ?? 0;
      if (!useNewImport) orderImportFee = info?.bill2?.import_fee ?? 0;
      if (!useNewExtra) orderExtraShipping = Object.values(info?.bill2?.extra_shipping_by_product ?? {}).reduce((a, b) => a + b, 0);
      const orderLocalShipping = useNewLocal ? parsedLocal : (info?.bill2?.local_shipping ?? 0);

      const finalTotal = roundUp(total + orderChinaShipping + orderImportFee + orderExtraShipping + orderLocalShipping);

      return {
        orderId,
        orderNumber: info?.number ?? String(orderId),
        customerName: info?.customer.name ?? "—",
        total: finalTotal,
        itemCount: items.length,
        orderChinaShipping: useNewChina ? orderChinaShipping : undefined,
        orderImportFee: useNewImport ? orderImportFee : undefined,
        orderExtraShipping: useNewExtra ? orderExtraShipping : undefined,
        orderLocalShipping: useNewLocal ? parsedLocal : undefined,
      };
    });
  }, [bulkItems, unitPrices, activeBatchOrders, chinaShippingPrices, importFeePrices, extraShippingPrices, localShippingPrice]);

  /** Read-only breakdown (incl. per-product lines) shown in the confirm preview — separate from
   * orderTotals above because handleSave relies on orderTotals' `undefined` sentinels to know
   * which fields to actually send (partial update), which a display-only shape doesn't need. */
  const previewOrders = useMemo<PreviewOrder[]>(() => {
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

    const useNewChina = Object.keys(chinaShippingPrices).length > 0;
    const useNewImport = Object.keys(importFeePrices).length > 0;
    const useNewExtra = Object.keys(extraShippingPrices).length > 0;
    const useNewLocal = localShippingPrice.trim() !== "";
    const parsedLocal = parseFloat(localShippingPrice) || 0;

    return Array.from(orderItemsMap.entries()).map(([orderId, items]) => {
      const info = activeBatchOrders.find((o) => o.id === orderId);
      let goods = 0, china = 0, importFee = 0, extraShipping = 0;
      const lines: PreviewProductLine[] = [];

      for (const item of items) {
        const unitPrice = numericPrices[item.item_id] ?? 0;
        const goodsAmount = roundUp(unitPrice * item.quantity);
        const chinaUnitTotal = parseFloat(chinaShippingPrices[item.item_id]) || 0;
        const importUnitTotal = parseFloat(importFeePrices[item.item_id]) || 0;
        const extraShippingUnitTotal = parseFloat(extraShippingPrices[item.item_id]) || 0;
        const chinaAmount = useNewChina ? chinaUnitTotal : 0;
        const importAmount = useNewImport ? importUnitTotal : 0;
        const extraShippingAmount = useNewExtra ? extraShippingUnitTotal : 0;

        goods += goodsAmount;
        china += chinaAmount;
        importFee += importAmount;
        extraShipping += extraShippingAmount;

        lines.push({
          productId: item.product.id,
          itemId: item.item_id,
          productName: item.name,
          qty: item.quantity,
          unitPrice,
          goodsAmount,
          chinaUnitTotal,
          chinaQtyTotal: item.quantity,
          chinaAmount,
          importUnitTotal,
          importAmount,
          extraShippingUnitTotal,
          extraShippingAmount,
        });
      }

      const finalChina = useNewChina ? china : (info?.bill2?.china_shipping ?? 0);
      const finalImport = useNewImport ? importFee : (info?.bill2?.import_fee ?? 0);
      const finalExtra = useNewExtra ? extraShipping : Object.values(info?.bill2?.extra_shipping_by_product ?? {}).reduce((a, b) => a + b, 0);
      const finalLocal = useNewLocal ? parsedLocal : (info?.bill2?.local_shipping ?? 0);

      return {
        orderId,
        orderNumber: info?.number ?? String(orderId),
        items: lines,
        goods,
        china: finalChina,
        importFee: finalImport,
        extraShipping: finalExtra,
        localShipping: finalLocal,
        baseTotal: roundUp(goods + finalChina + finalImport + finalExtra + finalLocal),
      };
    });
  }, [bulkItems, unitPrices, activeBatchOrders, chinaShippingPrices, importFeePrices, extraShippingPrices, localShippingPrice]);

  const pricedCount = Object.keys(unitPrices).length;

  const hasChanges = useMemo(() => {
    if (localShippingPrice.trim() !== "") return true;
    if (recordChanged(unitPrices, savedUnitPrices.current)) return true;
    if (recordChanged(chinaShippingPrices, savedChinaShippingPrices.current)) return true;
    if (recordChanged(importFeePrices, savedImportFeePrices.current)) return true;
    if (recordChanged(extraShippingPrices, savedExtraShippingPrices.current)) return true;
    return false;
  }, [unitPrices, chinaShippingPrices, importFeePrices, extraShippingPrices, localShippingPrice]);
  const totalBill2 = orderTotals.reduce((s, o) => s + o.total, 0);
  const isNewBatch = activeBatchId === null;
  const activeBatchHasLiveOrder = !isNewBatch && activeBatchOrders.some((o) => o.bill2.status !== "draft");
  const showDraftOption = isNewBatch || !activeBatchHasLiveOrder;

  const handleViewDetails = useCallback((product: OrderItemProduct) => {
    setModalProduct(product);
    openDetails();
  }, [openDetails]);

  const productColumns = useMemo(
    () => getProductColumns(
      unitPrices, setUnitPrices,
      chinaShippingPrices, setChinaShippingPrices,
      importFeePrices, setImportFeePrices,
      extraShippingPrices, setExtraShippingPrices,
      handleViewDetails
    ),
    [unitPrices, chinaShippingPrices, importFeePrices, extraShippingPrices, handleViewDetails]
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
    savedUnitPrices.current = merged;
    setUnitPrices(merged);

    // china_shipping_by_product / import_fee_by_product store each order's already-split
    // share — sum them back across the batch to reconstruct the "Total" the admin typed in.
    const sumByProduct = (pick: (o: OrderIF) => Record<number, number> | undefined) => {
      const totals: Record<number, number> = {};
      for (const order of batchOrders) {
        for (const [pid, amount] of Object.entries(pick(order) ?? {})) {
          if (!/^\d+$/.test(pid)) continue; // skips legacy '_legacy' flat-number entries
          totals[Number(pid)] = (totals[Number(pid)] ?? 0) + Number(amount);
        }
      }
      return Object.fromEntries(Object.entries(totals).map(([pid, total]) => [pid, String(total)]));
    };
    const china = sumByProduct((o) => o.bill2.china_shipping_by_product);
    const importFee = sumByProduct((o) => o.bill2.import_fee_by_product);
    const extraShipping = sumByProduct((o) => o.bill2.extra_shipping_by_product);
    savedChinaShippingPrices.current = china;
    savedImportFeePrices.current = importFee;
    savedExtraShippingPrices.current = extraShipping;
    setChinaShippingPrices(china);
    setImportFeePrices(importFee);
    setExtraShippingPrices(extraShipping);
    setLocalShippingPrice("");
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
      const orders = (res?.data ?? []).filter((o) => !o.is_rts);
      setAllOrders(orders);

      if (orders.length > 0) {
        const orderIds = orders.map((o) => o.id);
        const bulkRes: OrderProductsBulkResponse = await getProductsBulkByOrders({ orderIds, perPage: 100 });
        let allItems = bulkRes?.data ?? [];
        const { total_pages } = bulkRes.pagination;
        if (total_pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: total_pages - 1 }, (_, i) =>
              getProductsBulkByOrders({ orderIds, perPage: 100, page: i + 2 })
            )
          );
          for (const r of rest) allItems = allItems.concat(r?.data ?? []);
        }
        setBulkItems(allItems);
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
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [applyBatchPrices]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadData();
  }, [loadData]);

  const handleDeleteBatch = () => {
    if (!activeBatchId) return;
    withSpinner(async () => {
      try {
        await deleteBill2Batch(activeBatchId);
        closeDelete();
        setResultVariant("success");
        setResultMessage(`ลบรอบบิล ${formatBatchDate(activeBatchId)} เรียบร้อยแล้ว`);
        openResult();
        await loadData();
      } catch (err) {
        closeDelete();
        setResultVariant("error");
        setResultMessage("เกิดข้อผิดพลาดในการลบรอบบิล");
        openResult();
        if (import.meta.env.DEV) console.error(err);
      }
    });
  };

  const handleSave = (publish: boolean) => {
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
          orderTotals.map(async (info) => {
            const orderPrices: Record<number, number> = {};
            const items = bulkItems.filter(i => i.id === info.orderId);
            for (const item of items) {
              const price = numericPrices[item.item_id] ?? 0;
              if (price > 0) orderPrices[item.item_id] = price;
            }

            const preview = previewOrders.find((p) => p.orderId === info.orderId);
            let chinaByProduct: Record<number, number> | undefined;
            let importByProduct: Record<number, number> | undefined;
            let extraShippingByProduct: Record<number, number> | undefined;
            if (info.orderChinaShipping !== undefined) {
              chinaByProduct = {};
              for (const line of preview?.items ?? []) {
                if (line.chinaAmount > 0) chinaByProduct[line.itemId] = line.chinaAmount;
              }
            }
            if (info.orderImportFee !== undefined) {
              importByProduct = {};
              for (const line of preview?.items ?? []) {
                if (line.importAmount > 0) importByProduct[line.itemId] = line.importAmount;
              }
            }
            if (info.orderExtraShipping !== undefined) {
              extraShippingByProduct = {};
              for (const line of preview?.items ?? []) {
                if (line.extraShippingAmount > 0) extraShippingByProduct[line.itemId] = line.extraShippingAmount;
              }
            }

            const orderInfo = activeBatchOrders.find((o) => o.id === info.orderId)!;
            // Only touch bill2.status while it's still ours to move (draft/pending) — once the
            // customer has submitted/paid, an unrelated admin price tweak must not revert it.
            const hasProgressed = !["draft", "pending"].includes(orderInfo.bill2.status);
            const targetStatus = hasProgressed ? undefined : publish ? "pending" : "draft";

            await patchBill2(
              info.orderId,
              info.total,
              targetStatus,
              undefined,
              orderPrices,
              batchId,
              chinaByProduct,
              importByProduct,
              info.orderLocalShipping,
              extraShippingByProduct
            );
            if (orderInfo.status === "paid-1") {
              await patchOrderStatus(info.orderId, "wc-pending-payment-2");
            }
          })
        );

        closeConfirm();
        setResultVariant("success");
        setResultMessage(
          `${publish ? "เผยแพร่" : "บันทึกร่าง"}สำเร็จ! ${orderItemsMap.size} orders (Batch: ${batchId})`
        );
        openResult();
        await loadData();
      } catch (err) {
        closeConfirm();
        setResultVariant("error");
        setResultMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        openResult();
        if (import.meta.env.DEV) console.error(err);
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
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
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
        <div className="shrink-0 flex flex-col md:items-end">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Local Shipping (per order)
          </label>
          <div className="relative w-full md:w-48">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              ฿
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="ใช้ค่าเดิม (ปล่อยว่าง)"
              value={localShippingPrice}
              onChange={(e) => setLocalShippingPrice(e.target.value.replace(/[^\d.]/g, ""))}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            />
          </div>
        </div>
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
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-300">
              <p className="font-semibold mb-1">สูตรคำนวณยอดบิล 2 (ต่อออเดอร์):</p>
              <p className="font-mono text-xs opacity-90 mb-1.5">
                ยอดรวม = Σ(ราคาต่อหน่วย × จำนวน) + Σ(ค่าส่งจีนเฉลี่ยต่อชิ้น × จำนวน) + Σ(ค่านำเข้าเฉลี่ยต่อชิ้น × จำนวน) + ค่าจัดส่งพัสดุ
              </p>
              <ul className="list-disc pl-5 text-xs opacity-80 space-y-0.5">
                <li>หากกรอกค่าส่งจีน/นำเข้าใหม่ จะถูกนำมาเฉลี่ยต่อชิ้นและอัปเดตทับค่าเดิมใน Batch นี้ทั้งหมด</li>
                <li>หากปล่อยว่าง ระบบจะใช้ค่ายอดรวมเดิมของแต่ละออเดอร์ในการคำนวณ (ไม่แก้ไขของเดิม)</li>
                <li>ค่าจัดส่งพัสดุ = ยอดตามที่ระบุด้านบน (คิดต่อ 1 ออเดอร์) หากปล่อยว่างจะใช้ค่าเดิม</li>
              </ul>
            </div>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Batch ID</p>
                  <Badge size="sm" variant="light" color={activeBatchHasLiveOrder ? "success" : "warning"}>
                    {activeBatchHasLiveOrder ? "เผยแพร่แล้ว" : "ร่าง"}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-gray-600 dark:text-gray-300">{activeBatchId}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button
                variant="primary"
                size="sm"
                onClick={openConfirm}
                disabled={activeBatchOrders.length === 0 || totalBill2 === 0 || (!isNewBatch && !hasChanges)}
                className="w-full justify-center"
              >
                {showDraftOption
                  ? `บันทึก/เผยแพร่ ${activeBatchOrders.length} Orders`
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
              {!isNewBatch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openDelete}
                  className="w-full justify-center mt-2 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                >
                  ลบรอบบิลนี้
                </Button>
              )}
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

      {/* Confirm save — preview */}
      <Modal isOpen={isConfirmOpen} onClose={closeConfirm} className="max-w-4xl m-4 p-6">
        <div className="flex max-h-[85vh] flex-col">
          <div className="shrink-0 mb-5 pr-8">
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              {showDraftOption ? "บันทึกร่างหรือเผยแพร่" : "ยืนยันการอัปเดต"} — Bill 2 แต่ละ Order
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ตรวจสอบยอดก่อน{showDraftOption ? "บันทึก" : "อัปเดต"} ทั้งหมด {activeBatchOrders.length} orders
              {showDraftOption && " — บันทึกร่างจะยังไม่แสดงให้ลูกค้าเห็น"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto -mx-6 px-6">
            <BillPreviewTable orders={previewOrders} />
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 pt-5">
            <button
              onClick={closeConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
            >
              ยกเลิก
            </button>
            {showDraftOption && (
              <button
                onClick={() => handleSave(false)}
                disabled={spinning}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
              >
                บันทึกร่าง
              </button>
            )}
            <button
              onClick={() => handleSave(true)}
              disabled={spinning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
            >
              {showDraftOption ? "เผยแพร่ให้ลูกค้าเห็น" : "อัปเดต"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <AlertModal
        isOpen={isDeleteOpen}
        onClose={closeDelete}
        variant="error"
        title="ยืนยันการลบรอบบิล"
        message={`คุณต้องการลบรอบบิล ${formatBatchDate(activeBatchId ?? "")} ใช่หรือไม่? ข้อมูลค่าส่งต่างๆ และ Unit Prices จะถูกล้าง และสถานะออเดอร์จะกลับไปเป็น 'ชำระบิลแรกแล้ว'`}
        onConfirm={handleDeleteBatch}
        confirmLabel="ลบรอบบิล"
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
