import type { Order } from "../../interfaces/order.jaonaichan";
import Badge from "../ui/badge/Badge";
import { ORDER_STATUS_DETAILS, STATUS_PROGRESS } from "../../config/orderStatus.jaonaichan";
import type { BadgeColor } from "../ui/badge/Badge";

type PaymentMethod = "promptpay_qr" | "bank_transfer" | "cod";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  promptpay_qr: "PromptPay QR",
  bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery",
};

const PACKED_STATUSES = new Set(['packed', 'wait-tracking', 'tracked', 'wait-shipping', 'shipped']);

interface ListCardProps {
  order: Order;
  onView?: (order: Order) => void;
  onInvoice?: (orderId: number) => void;
  onUpdateStatus?: (order: Order) => void;
  onPack?: (order: Order) => void;
  /** ซ่อน progress bar + payment method สำหรับ context แคบ (เช่น customer modal) */
  compact?: boolean;
}

export default function ListCard({ order, onView, onInvoice, onUpdateStatus, onPack, compact = false }: ListCardProps) {
  const statusDetail = ORDER_STATUS_DETAILS[order.status] ?? { color: "light", text: order.status };

  let displayTotal = Number(order.total);
  const s = order.status;
  if (["pending-payment-1", "wait-verify-1", "paid-1", "waiting-transfer"].includes(s)) {
    displayTotal = Number(order.bill1?.amount || 0);
  } else if (["pending-payment-2", "wait-verify-2", "paid-2"].includes(s)) {
    displayTotal = Number(order.bill2?.amount || 0);
  }

  const date = new Date(order.date).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const pct = STATUS_PROGRESS[order.status] ?? 0;
  const barColor =
    pct === 0 ? "bg-gray-300 dark:bg-gray-600"
    : pct <= 40 ? "bg-amber-400 dark:bg-amber-500"
    : pct <= 65 ? "bg-blue-500 dark:bg-blue-400"
    : pct < 100 ? "bg-teal-500 dark:bg-teal-400"
    : "bg-emerald-500 dark:bg-emerald-400";

  const hasActions = onView || onInvoice || onUpdateStatus || onPack;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-white/[0.02]">
      {/* Order # + date + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">#{order.number}</span>
          <span className="text-xs text-gray-400">{date}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="light" color={statusDetail.color as BadgeColor} size="sm">
            {statusDetail.text}
          </Badge>
          {order.is_rts && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              ⚡ RTS
            </span>
          )}
        </div>
      </div>

      {/* Customer */}
      {!compact && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 truncate">
          {order.customer.name}
          <span className="text-xs text-gray-400 ml-1.5">{order.customer.email}</span>
        </p>
      )}

      {/* Total + payment method */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-gray-900 dark:text-white">
          ฿{displayTotal.toLocaleString()}
        </span>
        {!compact && (
          <span className="text-xs text-gray-400">
            {order.payment_method === "promptpay_qr"
              ? <img src="/images/order/prompt-pay-logo.jpg" className="h-5 object-contain" alt="PromptPay" />
              : (PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method)
            }
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!compact && (
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {(order.bill1?.status === "paid" ? 1 : 0) + (!order.is_rts && order.bill2?.status === "paid" ? 1 : 0)}/{order.is_rts ? 1 : 2}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
            <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Actions */}
      {hasActions && (
        <div className="flex gap-2">
          {onView && (
            <button
              onClick={() => onView(order)}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.04]"
            >
              View
            </button>
          )}
          {onInvoice && (
            <button
              onClick={() => onInvoice(order.id)}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.04]"
            >
              Invoice
            </button>
          )}
          {onUpdateStatus && (
            <button
              onClick={() => onUpdateStatus(order)}
              className="flex-1 rounded-lg border border-brand-200 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-700/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              Status
            </button>
          )}
          {onPack && (
            <button
              onClick={() => onPack(order)}
              className="flex-1 rounded-lg border border-teal-200 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:border-teal-700/40 dark:text-teal-400 dark:hover:bg-teal-500/10"
            >
              {PACKED_STATUSES.has(order.status) ? "View Pack" : "Pack"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
