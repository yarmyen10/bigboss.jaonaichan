import { Fragment } from "react";
import { PreviewOrder, roundUp } from "../../hooks/jaonaichan/useManageProducts";
import { CheckCircleIcon } from "../../icons";

interface BillPreviewTableProps {
  orders: PreviewOrder[];
  /** Omit both to hide the "เพิ่มเติม" extra-fee column entirely. */
  extraFees?: Record<number, string>;
  setExtraFees?: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

/** Read-only per-order Bill 2 breakdown table, shared by the Manage Orders save-preview
 * and the Bill2UnitPrices confirm-preview — same calculation, same columns. */
export default function BillPreviewTable({ orders, extraFees, setExtraFees }: BillPreviewTableProps) {
  const editable = !!setExtraFees;
  const finalTotalOf = (order: PreviewOrder) =>
    roundUp(order.baseTotal + (parseFloat(extraFees?.[order.orderId] ?? "") || 0));

  return (
    <table className="w-full text-sm">
      <thead>
        {/* sticky on each <th>, not <thead>/<tr> — table-header-group has spotty sticky support */}
        <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-left font-medium">Order</th>
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium">ค่าสินค้า</th>
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium">ค่าส่งจีน</th>
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium">ค่า Import</th>
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium">ค่าส่งไทย</th>
          {editable && (
            <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium w-28">เพิ่มเติม</th>
          )}
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-right font-medium">รวม Bill2 (฿)</th>
          <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-2 text-center font-medium">บันทึก?</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <Fragment key={order.orderId}>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-2 py-2.5 font-medium text-gray-800 dark:text-white/90">
                #{order.orderNumber}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {order.goods.toFixed(2)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                {order.china.toFixed(2)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-violet-600 dark:text-violet-400">
                {order.importFee.toFixed(2)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-purple-600 dark:text-purple-400">
                {order.localShipping.toFixed(2)}
              </td>
              {editable && (
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={extraFees?.[order.orderId] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d.]/g, "");
                      setExtraFees?.((prev) => ({ ...prev, [order.orderId]: val }));
                    }}
                    className="h-8 w-full rounded-md border border-gray-300 bg-transparent px-2 text-right text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  />
                </td>
              )}
              <td className="px-2 py-2.5 text-right tabular-nums font-bold text-brand-600 dark:text-brand-400">
                {finalTotalOf(order).toFixed(2)}
              </td>
              <td className="px-2 py-2.5 text-center">
                <CheckCircleIcon className="inline-block size-5 text-success-500" />
              </td>
            </tr>
            {order.items.map((line) => (
              <tr key={line.productId} className="text-xs text-gray-400 dark:text-gray-500 italic">
                <td className="px-2 pb-1.5 pl-4">{line.productName}: {line.qty} ชิ้น</td>
                <td className="px-2 pb-1.5 text-right">{line.unitPrice.toFixed(2)} × {line.qty} = {line.goodsAmount.toFixed(2)}</td>
                <td className="px-2 pb-1.5 text-right">{line.chinaUnitTotal.toFixed(2)} ÷ {line.chinaQtyTotal} × {line.qty} = {line.chinaAmount.toFixed(2)}</td>
                <td className="px-2 pb-1.5 text-right">{line.importUnitTotal.toFixed(2)} ÷ {line.chinaQtyTotal} × {line.qty} = {line.importAmount.toFixed(2)}</td>
                <td colSpan={editable ? 4 : 3}></td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
          <td className="px-2 py-3 text-gray-700 dark:text-gray-300" colSpan={editable ? 6 : 5}>
            รวม batch ทั้งหมด
          </td>
          <td className="px-2 py-3 text-right tabular-nums text-brand-600 dark:text-brand-400">
            {orders.reduce((sum, o) => sum + finalTotalOf(o), 0).toFixed(2)}
          </td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  );
}
