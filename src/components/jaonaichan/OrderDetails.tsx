import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import Badge, { BadgeColor } from "../ui/badge/Badge";
import { Order, OrderDetailResponse, OrderItem } from "../../interfaces/order.jaonaichan";
import { getOrder } from "../../services/jaonaichan";

interface OrderDetailsProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_MAP: Record<string, { color: BadgeColor; text: string }> = {
  pending:            { color: "primary", text: "Pending payment" },
  processing:         { color: "warning", text: "Processing" },
  "on-hold":          { color: "dark",    text: "On hold" },
  completed:          { color: "success", text: "Completed" },
  cancelled:          { color: "light",   text: "Cancelled" },
  refunded:           { color: "light",   text: "Refunded" },
  failed:             { color: "error",   text: "Failed" },
  "checkout-draft":   { color: "light",   text: "Draft" },
  "waiting-transfer": { color: "warning", text: "Waiting Transfer" },
};

const BILL_STATUS_MAP: Record<string, { color: BadgeColor; text: string }> = {
  paid:      { color: "success", text: "Paid" },
  pending:   { color: "warning", text: "Pending" },
  cancelled: { color: "light",   text: "Cancelled" },
};

const PAYMENT_LABEL: Record<string, string> = {
  promptpay_qr:  "PromptPay QR",
  bank_transfer: "Bank Transfer",
  cod:           "Cash on Delivery",
};

function parseAddressLines(raw: string): string[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">{children}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 min-w-0 overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function BillRow({
  label,
  amount,
  status,
  paidAt,
}: {
  label: string;
  amount: number;
  status: string;
  paidAt: string | null;
}) {
  const badge = BILL_STATUS_MAP[status] ?? { color: "light" as BadgeColor, text: status };
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            ฿{Number(amount).toLocaleString()}
          </span>
          <Badge variant="light" size="sm" color={badge.color}>
            {badge.text}
          </Badge>
        </div>
      </div>
      {paidAt && (
        <p className="text-right text-xs text-gray-400 dark:text-gray-500">
          Paid {new Date(paidAt).toLocaleDateString("th-TH")}
        </p>
      )}
    </div>
  );
}

function ItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Product
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Qty
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Unit Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item) => (
            <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {item.product.image?.thumbnail ? (
                    <img
                      src={item.product.image.thumbnail}
                      alt={item.name}
                      className="h-10 w-10 shrink-0 rounded object-cover bg-gray-100 dark:bg-gray-800"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
                  )}
                  <div className="min-w-0">
                    <p className="max-w-[220px] truncate text-sm font-medium text-gray-800 dark:text-white">
                      {item.name}
                    </p>
                    {item.variation.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {item.variation.map((v) => `${v.key}: ${v.value}`).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.product.sku}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                {item.quantity}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                ฿{Number(item.unit_price).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800 dark:text-white">
                ฿{Number(item.subtotal).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrderDetails({ order, isOpen, onClose }: OrderDetailsProps) {
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) return;
    setLoading(true);
    setDetail(null);
    getOrder(order.id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, order?.id]);

  const displayed = detail ?? order;
  const items: OrderItem[] = detail?.items ?? [];

  const statusInfo = displayed
    ? (STATUS_MAP[displayed.status] ?? { color: "light" as BadgeColor, text: displayed.status })
    : null;

  const formattedDate = displayed
    ? new Date(displayed.date).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} isFullscreen showCloseButton={false}>
      <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Order #{displayed?.number ?? displayed?.id ?? "—"}
              </h2>
              {statusInfo && (
                <Badge variant="light" color={statusInfo.color}>
                  {statusInfo.text}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">{formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
          {!displayed ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No order selected.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Info cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SectionCard title="Customer">
                  <InfoRow label="Name">{displayed.customer.name}</InfoRow>
                  <InfoRow label="Email">{displayed.customer.email}</InfoRow>
                  {displayed.customer.phone && (
                    <InfoRow label="Phone">{displayed.customer.phone}</InfoRow>
                  )}
                </SectionCard>

                <SectionCard title="Billing & Payment">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Address</span>
                    {displayed.billing.address ? (
                      parseAddressLines(displayed.billing.address).map((line, i) => (
                        <span key={i} className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">
                          {line}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <InfoRow label="Payment method">
                      {PAYMENT_LABEL[displayed.payment_method] ?? displayed.payment_method}
                    </InfoRow>
                  </div>
                </SectionCard>

                <SectionCard title="Bills">
                  <BillRow
                    label="Bill 1"
                    amount={displayed.bill1.amount}
                    status={displayed.bill1.status}
                    paidAt={displayed.bill1.paid_at}
                  />
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <BillRow
                      label="Bill 2"
                      amount={displayed.bill2.amount}
                      status={displayed.bill2.status}
                      paidAt={displayed.bill2.paid_at}
                    />
                  </div>
                </SectionCard>
              </div>

              {/* Items */}
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Items
                </p>
                {loading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No items to display.</p>
                ) : (
                  <ItemsTable items={items} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 px-6 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              ฿{displayed ? Number(displayed.total).toLocaleString() : "—"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
