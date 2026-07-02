import { useState } from "react";
import { Order as OrderIF, OrderItemProduct, OrderProductsBulkItem, OrderProductsBulkResponse } from "../../interfaces/order.jaonaichan";
import { getProductsBulkByOrders, patchBill2, patchOrderStatus } from "../../services/jaonaichan";
import { resolveManageTabs, STATUS_MANAGE_ACTIONS } from "../../config/manageOrders.jaonaichan";
import { TabOption } from "../../components/ui/tabs";
import { useModal } from "../useModal";

/** Rounds up to the nearest 0.5 baht — division splits rarely land on a clean amount. */
export const roundUp = (n: number) => Math.ceil(n * 2) / 2;

export interface PreviewProductLine {
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  goodsAmount: number;
  chinaUnitTotal: number;
  chinaQtyTotal: number;
  chinaAmount: number;
  importUnitTotal: number;
  importAmount: number;
}

export interface PreviewOrder {
  orderId: number;
  orderNumber: string;
  items: PreviewProductLine[];
  goods: number;
  china: number;
  importFee: number;
  localShipping: number;
  baseTotal: number; // goods + china + importFee + localShipping, before extra fee
}

interface UseManageProductsParams {
  withSpinner: (fn: () => Promise<void>) => void;
  openModal: () => void;
  closeModal: () => void;
  openAlert: () => void;
  onSaved: () => void; // Usually loadOrders(dateFilter)
}

export function useManageProducts({
  withSpinner,
  openModal,
  closeModal,
  onSaved
}: UseManageProductsParams) {
  const [products, setProducts] = useState<OrderItemProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const selectedProduct = products.find(p => p.id === selectedProductId) ?? null;

  const [sheetProductId, setSheetProductId] = useState<number | null>(null);
  const sheetProduct = products.find(p => p.id === sheetProductId) ?? null;

  const [unitPrices, setUnitPrices] = useState<Record<number, string>>({});
  const [chinaShippingPrices, setChinaShippingPrices] = useState<Record<number, string>>({});
  const [importFeePrices, setImportFeePrices] = useState<Record<number, string>>({});
  const [localShippingPrice, setLocalShippingPrice] = useState<string>("0");

  const [manageOrdersTabs, setManageOrdersTabs] = useState([] as TabOption[]);
  const [manageOrderItems, setManageOrderItems] = useState<OrderProductsBulkItem[]>([]);
  const [activeManageTab, setActiveManageTab] = useState<string>("");

  // ── Save Preview ──
  const { isOpen: isPreviewOpen, openModal: openPreviewModal, closeModal: closePreviewModal } = useModal();
  const [previewOrders, setPreviewOrders] = useState<PreviewOrder[]>([]);
  const [previewBatchId, setPreviewBatchId] = useState("");
  const [extraFees, setExtraFees] = useState<Record<number, string>>({});

  const initialManageOrders = (selectedOrders: OrderIF[]) => {
    withSpinner(async () => {
      const orderIds = selectedOrders.map(o => o.id);
      const res: OrderProductsBulkResponse = await getProductsBulkByOrders({ orderIds });

      const manageable = (res?.data ?? []).filter((item: OrderProductsBulkItem) =>
        (STATUS_MANAGE_ACTIONS[item.status]?.length ?? 0) > 0 && !item.bill2.unit_prices_id
      );
      if (manageable.length === 0) {
        window.alert("ไม่มีรายการที่สามารถจัดการ Bill 2 ได้ (อาจตั้งราคาไปแล้ว หรือสถานะไม่ถูกต้อง)");
        return;
      }
      setManageOrderItems(manageable);

      const uniqueProducts = new Map<number, OrderItemProduct>();
      for (const item of manageable) {
        if (!uniqueProducts.has(item.product.id)) {
          uniqueProducts.set(item.product.id, item.product);
        }
      }
      setProducts(Array.from(uniqueProducts.values()));

      const tabs = resolveManageTabs(selectedOrders);
      setManageOrdersTabs(tabs);
      setActiveManageTab(tabs[0]?.value ?? "");
      setUnitPrices({});
      setChinaShippingPrices({});
      setImportFeePrices({});
      setLocalShippingPrice("0");
    });
    openModal();
  };

  /** Validates inputs, computes the per-order breakdown, and opens the preview modal. */
  const handleSaveOrders = () => {
    if (activeManageTab !== "bill2") return;

    const numericPrices: Record<number, number> = {};
    let hasAnyPrice = false;

    for (const [pid, raw] of Object.entries(unitPrices)) {
      const price = parseFloat(raw) || 0;
      if (price > 0) {
        numericPrices[Number(pid)] = price;
        hasAnyPrice = true;
      }
    }
    for (const [, raw] of Object.entries(chinaShippingPrices)) {
      if ((parseFloat(raw) || 0) > 0) hasAnyPrice = true;
    }
    for (const [, raw] of Object.entries(importFeePrices)) {
      if ((parseFloat(raw) || 0) > 0) hasAnyPrice = true;
    }

    if (!hasAnyPrice) {
      window.alert("กรุณากรอกราคา/ค่าส่ง อย่างน้อย 1 รายการ");
      return;
    }

    const now = new Date();
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    const batchId = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;

    const orderItemsMap = new Map<number, typeof manageOrderItems>();
    const productTotalQuantity: Record<number, number> = {};
    for (const item of manageOrderItems) {
      if (!orderItemsMap.has(item.id)) orderItemsMap.set(item.id, []);
      orderItemsMap.get(item.id)!.push(item);
      productTotalQuantity[item.product.id] = (productTotalQuantity[item.product.id] || 0) + item.quantity;
    }

    const orderLocalShipping = parseFloat(localShippingPrice) || 0;
    const preview: PreviewOrder[] = [];

    for (const [orderId, items] of orderItemsMap.entries()) {
      let goods = 0, china = 0, importFee = 0;
      const lines: PreviewProductLine[] = [];

      for (const item of items) {
        const unitPrice = numericPrices[item.product.id] ?? 0;
        const goodsAmount = roundUp(unitPrice * item.quantity);
        const chinaUnitTotal = parseFloat(chinaShippingPrices[item.product.id]) || 0;
        const importUnitTotal = parseFloat(importFeePrices[item.product.id]) || 0;
        const chinaQtyTotal = productTotalQuantity[item.product.id] || 1;
        const chinaAmount = roundUp((chinaUnitTotal / chinaQtyTotal) * item.quantity);
        const importAmount = roundUp((importUnitTotal / chinaQtyTotal) * item.quantity);

        goods += goodsAmount;
        china += chinaAmount;
        importFee += importAmount;

        lines.push({
          productId: item.product.id,
          productName: item.product.name,
          qty: item.quantity,
          unitPrice,
          goodsAmount,
          chinaUnitTotal,
          chinaQtyTotal,
          chinaAmount,
          importUnitTotal,
          importAmount,
        });
      }

      const baseTotal = roundUp(goods + china + importFee + orderLocalShipping);
      if (baseTotal > 0) {
        preview.push({
          orderId,
          orderNumber: items[0]?.number ?? String(orderId),
          items: lines,
          goods,
          china,
          importFee,
          localShipping: orderLocalShipping,
          baseTotal,
        });
      }
    }

    if (preview.length === 0) {
      window.alert("ไม่มี order ที่คำนวณยอดได้มากกว่า 0 บาท");
      return;
    }

    setPreviewOrders(preview);
    setPreviewBatchId(batchId);
    setExtraFees({});
    openPreviewModal();
  };

  /** Actually persists bill2 + status for every order in the preview, including any extra fee. */
  const handleConfirmSaveOrders = () => {
    withSpinner(async () => {
      await Promise.all(
        previewOrders.map(async (order) => {
          const extra = parseFloat(extraFees[order.orderId]) || 0;
          const finalTotal = roundUp(order.baseTotal + extra);
          const orderPrices: Record<number, number> = {};
          const chinaByProduct: Record<number, number> = {};
          const importByProduct: Record<number, number> = {};
          for (const line of order.items) {
            if (line.unitPrice > 0) orderPrices[line.productId] = line.unitPrice;
            if (line.chinaAmount > 0) chinaByProduct[line.productId] = line.chinaAmount;
            if (line.importAmount > 0) importByProduct[line.productId] = line.importAmount;
          }
          await patchBill2(order.orderId, finalTotal, 'pending', undefined, orderPrices, previewBatchId, chinaByProduct, importByProduct, order.localShipping);
          await patchOrderStatus(order.orderId, 'wc-pending-payment-2');
        })
      );
      closePreviewModal();
      closeModal();
      onSaved();
    });
  };

  return {
    products,
    selectedProductId,
    setSelectedProductId,
    selectedProduct,
    sheetProductId,
    setSheetProductId,
    sheetProduct,
    unitPrices,
    setUnitPrices,
    chinaShippingPrices,
    setChinaShippingPrices,
    importFeePrices,
    setImportFeePrices,
    localShippingPrice,
    setLocalShippingPrice,
    manageOrdersTabs,
    activeManageTab,
    setActiveManageTab,
    initialManageOrders,
    handleSaveOrders,

    isPreviewOpen,
    closePreviewModal,
    previewOrders,
    previewBatchId,
    extraFees,
    setExtraFees,
    handleConfirmSaveOrders,
  };
}
