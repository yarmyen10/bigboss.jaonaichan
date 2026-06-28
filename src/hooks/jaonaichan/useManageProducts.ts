import { useState } from "react";
import { Order as OrderIF, OrderItemProduct, OrderProductsBulkItem, OrderProductsBulkResponse } from "../../interfaces/order.jaonaichan";
import { getProductsBulkByOrders, patchBill2, patchOrderStatus } from "../../services/jaonaichan";
import { resolveManageTabs, STATUS_MANAGE_ACTIONS } from "../../config/manageOrders.jaonaichan";
import { TabOption } from "../../components/ui/tabs";

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
  const [localShippingPrice, setLocalShippingPrice] = useState<string>("30");

  const [manageOrdersTabs, setManageOrdersTabs] = useState([] as TabOption[]);
  const [manageOrderItems, setManageOrderItems] = useState<OrderProductsBulkItem[]>([]);
  const [activeManageTab, setActiveManageTab] = useState<string>("");

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
      setLocalShippingPrice("30");
    });
    openModal();
  };

  const handleSaveOrders = () => {
    withSpinner(async () => {
      if (activeManageTab === "bill2") {
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
          return; // Block saving
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
        await Promise.all(
          Array.from(orderItemsMap.entries()).map(async ([orderId, items]) => {
            const orderPrices: Record<number, number> = {};
            let total = 0;
            let orderChinaShipping = 0;
            let orderImportFee = 0;
            const orderLocalShipping = parseFloat(localShippingPrice) || 0;

            for (const item of items) {
              const price = numericPrices[item.product.id] ?? 0;
              if (price > 0) orderPrices[item.product.id] = price;
              total += price * item.quantity;
              
              const totalChina = parseFloat(chinaShippingPrices[item.product.id]) || 0;
              const totalImport = parseFloat(importFeePrices[item.product.id]) || 0;
              const totalQty = productTotalQuantity[item.product.id] || 1;
              
              orderChinaShipping += (totalChina / totalQty) * item.quantity;
              orderImportFee += (totalImport / totalQty) * item.quantity;
            }

            const finalTotal = total + orderChinaShipping + orderImportFee + orderLocalShipping;
            if (finalTotal > 0) {
              await patchBill2(orderId, finalTotal, 'pending', undefined, orderPrices, batchId, orderChinaShipping, orderImportFee, orderLocalShipping);
              await patchOrderStatus(orderId, 'wc-pending-payment-2');
            }
          })
        );
      }
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
    handleSaveOrders
  };
}
