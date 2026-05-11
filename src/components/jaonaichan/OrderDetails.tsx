import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../ui/modal";
import Badge, { BadgeColor } from "../ui/badge/Badge";
import BasicTableOne, { BasicTableColumn } from "../tables/BasicTables/BasicTableOne";
import { Order, OrderDetailResponse, OrderItem } from "../../interfaces/order.jaonaichan";
import { getBillSlipObjectUrl, getOrder } from "../../services/jaonaichan";
import { ReceiptApproved, ReceiptBill, ReceiptDeclined, ReceiptRecheck } from "../../icons";

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
  "pending-payment-1": { color: "warning", text: "Pending payment 1" },
  "pending-payment-2": { color: "warning", text: "Pending payment 2" },
  "wait-verify-1": { color: "warning", text: "Waiting for Verification 1" },
  "wait-verify-2": { color: "warning", text: "Waiting for Verification 2" },
  "paid-1": { color: "primary", text: "Paid 1" },
  "paid-2": { color: "primary", text: "Paid 2" },
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

const SLIP_ICON_MAP: Record<string, { Icon: React.FC<React.SVGProps<SVGSVGElement>>; className: string }> = {
  paid:      { Icon: ReceiptApproved, className: "text-green-500" },
  cancelled: { Icon: ReceiptDeclined, className: "text-gray-400 dark:text-gray-600" },
};

function BillRow({
  label,
  amount,
  status,
  paidAt,
  slipUrl,
  onPreviewSlip,
}: {
  label: string;
  amount: number;
  status: string;
  paidAt: string | null;
  slipUrl?: string | null;
  onPreviewSlip?: (url: string) => void;
}) {
  const badge = BILL_STATUS_MAP[status] ?? { color: "light" as BadgeColor, text: status };
  const { Icon, className: iconClass } = SLIP_ICON_MAP[status] ?? {
    Icon: slipUrl ? ReceiptRecheck : ReceiptBill,
    className: slipUrl ? "text-orange-400" : "text-gray-300 dark:text-gray-600",
  };

  const icon = (
    <Icon className={`size-10 shrink-0 ${iconClass}`} />
  );

  return (
    <div className="space-y-1.5">
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
      <div className="flex justify-center py-1">
        {slipUrl ? (
          <button
            type="button"
            onClick={() => onPreviewSlip?.(slipUrl)}
            title="Click to preview slip"
            className="transition-opacity hover:opacity-70"
          >
            {icon}
          </button>
        ) : (
          icon
        )}
      </div>
    </div>
  );
}

const ITEM_COLUMNS: BasicTableColumn[] = [
  { key: "product", label: "Product" },
  { key: "qty", label: "Quantity", className: "text-center" },
  { key: "unitPrice", label: "Unit Price", className: "text-right" },
  { key: "subtotal", label: "Subtotal", className: "text-right" },
  { key: "lineTotal", label: "Total", className: "text-right" },
];

function ItemsTable({ items }: { items: OrderItem[] }) {
  const rows = items.map((item) => ({
    product: (
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
    ),
    qty: item.quantity,
    unitPrice: `฿${Number(item.unit_price).toLocaleString()}`,
    subtotal: (
      <span className="font-semibold text-gray-800 dark:text-white">
        ฿{Number(item.subtotal).toLocaleString()}
      </span>
    ),
    lineTotal: (
      <span className="font-semibold text-gray-800 dark:text-white">
        ฿{Number(item.total).toLocaleString()}
      </span>
    ),
  }));

  return <BasicTableOne columns={ITEM_COLUMNS} rows={rows} />;
}

export default function OrderDetails({ order, isOpen, onClose }: OrderDetailsProps) {
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [slip1, setSlip1] = useState<string | null>(null);
  const [slip2, setSlip2] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen || !displayed) return;

    setSlip1(null);
    setSlip2(null);
    setPreviewUrl(null);

    let cancelled = false;
    const created: string[] = [];

    const load = async (bill: 1 | 2, setter: (u: string | null) => void) => {
      try {
        const url = await getBillSlipObjectUrl(displayed.id, bill);
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) created.push(url);
        setter(url);
      } catch (err) {
        console.error(`load slip ${bill}`, err);
      }
    };

    load(1, setSlip1);
    load(2, setSlip2);

    return () => {
      cancelled = true;
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [isOpen, displayed?.id]);

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
                    slipUrl={slip1}
                    onPreviewSlip={setPreviewUrl}
                  />
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <BillRow
                      label="Bill 2"
                      amount={displayed.bill2.amount}
                      status={displayed.bill2.status}
                      paidAt={displayed.bill2.paid_at}
                      slipUrl={slip2}
                      onPreviewSlip={setPreviewUrl}
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
      {previewUrl && createPortal(
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <img
            src={previewUrl}
            alt="Slip preview"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close preview"
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
        </div>,
        document.body
      )}
    </Modal>
  );
}
