import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../ui/modal";
import Badge, { BadgeColor } from "../ui/badge/Badge";
import BasicTableOne, { BasicTableColumn } from "../tables/BasicTables/BasicTableOne";
import { Order, OrderDetailResponse, OrderItem } from "../../interfaces/order.jaonaichan";
import { getBillSlipObjectUrl, getOrder, patchOrderShipping, reVerifySlip } from "../../services/jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";
import { BoxIcon, PencilIcon, ReceiptApproved, ReceiptBill, ReceiptDeclined } from "../../icons";

interface OrderDetailsProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}


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

interface HistoryEvent {
  id: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  date: string | null;
  slipUrl?: string | null;
  canReVerify?: boolean;
  bill?: 1 | 2;
}

const BILL_STYLE: Record<string, { Icon: React.FC<React.SVGProps<SVGSVGElement>>; iconBg: string; iconColor: string }> = {
  paid:      { Icon: ReceiptApproved, iconBg: "bg-green-50 dark:bg-green-500/10",  iconColor: "text-green-500" },
  submitted: { Icon: ReceiptBill,     iconBg: "bg-blue-50 dark:bg-blue-500/10",    iconColor: "text-blue-500" },
  pending:   { Icon: ReceiptBill,     iconBg: "bg-amber-50 dark:bg-amber-500/10",  iconColor: "text-amber-500" },
  cancelled: { Icon: ReceiptDeclined, iconBg: "bg-gray-100 dark:bg-gray-800",      iconColor: "text-gray-400 dark:text-gray-500" },
};

function buildHistory(
  displayed: Order | OrderDetailResponse,
  slip1: string | null,
  slip2: string | null,
): HistoryEvent[] {
  const paidEvents: HistoryEvent[] = [];
  const pendingEvents: HistoryEvent[] = [];

  const placed: HistoryEvent = {
    id: "placed",
    Icon: BoxIcon,
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
    iconColor: "text-blue-500",
    title: "Order Placed",
    subtitle: PAYMENT_LABEL[displayed.payment_method] ?? displayed.payment_method,
    date: displayed.date,
  };

  const billEntries: [string, typeof displayed.bill1, string | null, 1 | 2][] = [
    ["bill1", displayed.bill1, slip1, 1],
  ];
  if (!displayed.is_rts) billEntries.push(["bill2", displayed.bill2, slip2, 2]);

  for (const [key, bill, slip, billNum] of billEntries) {
    const hasStoredSlip = bill.status === "submitted" && slip !== null;
    const style = hasStoredSlip
      ? { Icon: ReceiptBill, iconBg: "bg-blue-50 dark:bg-blue-500/10", iconColor: "text-blue-500" }
      : (BILL_STYLE[bill.status] ?? BILL_STYLE.pending);
    const label = key === "bill1" ? "Bill 1" : "Bill 2";
    const statusLabel =
      bill.status === "paid"      ? "Paid"           :
      bill.status === "cancelled" ? "Cancelled"      :
      hasStoredSlip               ? "Waiting Verify" :
                                    "Pending";
    const event: HistoryEvent = {
      id: key,
      ...style,
      title: `${label} · ${statusLabel}`,
      subtitle: `฿${Number(bill.amount).toLocaleString()}`,
      date: bill.paid_at,
      slipUrl: slip,
      canReVerify: hasStoredSlip,
      bill: billNum,
    };
    if (bill.paid_at) paidEvents.push(event);
    else pendingEvents.push(event);
  }

  paidEvents.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  return [placed, ...paidEvents, ...pendingEvents];
}

function OrderHistoryTimeline({
  events,
  onPreviewSlip,
  onReVerify,
  reVerifying,
  reVerifyError,
}: {
  events: HistoryEvent[];
  onPreviewSlip: (url: string) => void;
  onReVerify: (bill: 1 | 2) => void;
  reVerifying: boolean;
  reVerifyError: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        Order History
      </p>
      {reVerifyError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {reVerifyError}
        </div>
      )}
      <div>
        {events.map((event, i) => {
          const d = event.date ? new Date(event.date) : null;
          const time = d ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
          const date = d ? d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" }) : "";
          const isLast = i === events.length - 1;
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${event.iconBg}`}>
                  <event.Icon className={`size-5 ${event.iconColor}`} />
                </div>
                {!isLast && (
                  <div className="my-1 w-px flex-1 border-l-2 border-dashed border-gray-200 dark:border-gray-700" />
                )}
              </div>
              <div className={`flex flex-1 items-start justify-between gap-2 ${!isLast ? "pb-4" : ""}`}>
                <div className="min-w-0 pt-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{event.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{event.subtitle}</p>
                  {event.slipUrl && (
                    <button
                      type="button"
                      onClick={() => onPreviewSlip(event.slipUrl!)}
                      className="mt-1 text-xs text-brand-500 hover:underline"
                    >
                      View Slip
                    </button>
                  )}
                  {event.canReVerify && event.bill && (
                    <button
                      type="button"
                      onClick={() => onReVerify(event.bill!)}
                      disabled={reVerifying}
                      className="mt-1 flex items-center gap-1 text-xs text-amber-500 hover:underline disabled:opacity-50"
                    >
                      {reVerifying ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-amber-500 border-t-transparent" />
                          Verifying…
                        </>
                      ) : (
                        "Re-verify Slip"
                      )}
                    </button>
                  )}
                </div>
                <div className="shrink-0 pt-2 text-right">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{time}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
                </div>
              </div>
            </div>
          );
        })}
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
  const [reVerifying, setReVerifying] = useState(false);
  const [reVerifyError, setReVerifyError] = useState<string | null>(null);

  const [editShippingOpen, setEditShippingOpen] = useState(false);
  const [shippingInput, setShippingInput] = useState({ name: "", phone: "", address: "" });
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) return;
    setLoading(true);
    setDetail(null);
    setReVerifyError(null);
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

  const handleReVerify = async (bill: 1 | 2) => {
    if (!displayed) return;
    setReVerifying(true);
    setReVerifyError(null);
    try {
      const res = await reVerifySlip(displayed.id, bill);
      if (!res.success) throw new Error(res.message);
      // Reload order detail so bill status + icon update
      const fresh = await getOrder(displayed.id);
      setDetail(fresh);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
      setReVerifyError(msg);
    } finally {
      setReVerifying(false);
    }
  };

  const handleEditShipping = () => {
    if (!displayed || !displayed.shipping) return;
    setShippingInput({
      name: displayed.shipping.name || "",
      phone: displayed.shipping.phone || "",
      address: displayed.shipping.address || "",
    });
    setEditShippingOpen(true);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayed) return;
    setSavingShipping(true);
    try {
      await patchOrderShipping(displayed.id, shippingInput);
      const fresh = await getOrder(displayed.id);
      setDetail(fresh);
      setEditShippingOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to update shipping");
    } finally {
      setSavingShipping(false);
    }
  };

  const statusInfo = displayed
    ? (ORDER_STATUS_DETAILS[displayed.status] ?? { color: "light" as BadgeColor, text: displayed.status })
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
                <Badge variant="gradient" color={statusInfo.color}>
                  {statusInfo.text}
                </Badge>
              )}
              {displayed?.is_rts && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  ⚡ พร้อมส่ง
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-400 dark:text-gray-500">{formattedDate}</p>
              {displayed?.linked_rts_order_id && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  RTS Order: #{displayed.linked_rts_order_id}
                </span>
              )}
              {displayed?.parent_order_id && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Order หลัก: #{displayed.parent_order_id}
                </span>
              )}
            </div>
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
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Info cards — 2 columns */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionCard title="Customer">
                  <InfoRow label="Name">{displayed.customer.name}</InfoRow>
                  <InfoRow label="Email">{displayed.customer.email}</InfoRow>
                  {displayed.customer.phone && (
                    <InfoRow label="Phone">{displayed.customer.phone}</InfoRow>
                  )}
                </SectionCard>

                <SectionCard title="Billing & Shipping">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Left: Billing */}
                    <div className="flex flex-col gap-3 min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Billing Address</span>
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
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-auto">
                        <InfoRow label="Payment method">
                          {PAYMENT_LABEL[displayed.payment_method] ?? displayed.payment_method}
                        </InfoRow>
                      </div>
                    </div>

                    {/* Right: Shipping */}
                    <div className="flex flex-col gap-3 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-800 pt-4 sm:pt-0 sm:pl-4 relative">
                      <button
                        type="button"
                        onClick={handleEditShipping}
                        className="absolute top-0 sm:top-[-4px] right-0 p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md transition"
                        title="Edit Shipping"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 pr-6">Shipping Info</span>
                        {displayed.shipping && (displayed.shipping.name || displayed.shipping.address) ? (
                          <>
                            <span className="text-sm font-medium text-gray-800 dark:text-white/90 break-words mt-1">
                              {displayed.shipping.name}
                            </span>
                            {displayed.shipping.phone && (
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {displayed.shipping.phone}
                              </span>
                            )}
                            {displayed.shipping.address && (
                              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line mt-1">
                                {displayed.shipping.address}
                              </span>
                            )}
                            {displayed.shipping.tracking && displayed.shipping.tracking.length > 0 && (
                              <div className="flex flex-col gap-1 mt-2">
                                {displayed.shipping.tracking.map((p, i) => {
                                  const colors: Record<string, string> = { kerry: 'bg-[#E30013] text-white', flash: 'bg-[#FF6B00] text-white', jt: 'bg-[#E8000D] text-white', thaipost: 'bg-[#6B2D8B] text-white' };
                                  const labels: Record<string, string> = { kerry: 'KEX', flash: 'FLASH', jt: 'J&T', thaipost: 'POST' };
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${colors[p.carrier] ?? 'bg-gray-400 text-white'}`}>{labels[p.carrier] ?? p.carrier.toUpperCase()}</span>
                                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{p.number}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-amber-500 mt-1 italic">รอข้อมูลจัดส่ง</span>
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Items + Order History side by side */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                <div>
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

                <OrderHistoryTimeline
                  events={buildHistory(displayed, slip1, slip2)}
                  onPreviewSlip={setPreviewUrl}
                  onReVerify={handleReVerify}
                  reVerifying={reVerifying}
                  reVerifyError={reVerifyError}
                />
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

      {/* Edit Shipping Modal */}
      <Modal isOpen={editShippingOpen} onClose={() => !savingShipping && setEditShippingOpen(false)} className="max-w-md w-full">
        <form onSubmit={handleSaveShipping} className="flex flex-col bg-white dark:bg-gray-900 rounded-xl">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">แก้ไขข้อมูลจัดส่ง</h3>
            <button
              type="button"
              onClick={() => !savingShipping && setEditShippingOpen(false)}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" /></svg>
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ชื่อผู้รับ</label>
              <input
                type="text"
                required
                value={shippingInput.name}
                onChange={e => setShippingInput(s => ({ ...s, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">เบอร์โทรศัพท์</label>
              <input
                type="tel"
                required
                value={shippingInput.phone}
                onChange={e => setShippingInput(s => ({ ...s, phone: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ที่อยู่จัดส่ง</label>
              <textarea
                required
                rows={3}
                value={shippingInput.address}
                onChange={e => setShippingInput(s => ({ ...s, address: e.target.value }))}
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition resize-none custom-scrollbar"
              ></textarea>
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 p-5 flex gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
            <button
              type="button"
              onClick={() => setEditShippingOpen(false)}
              disabled={savingShipping}
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={savingShipping}
              className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition flex items-center justify-center"
            >
              {savingShipping ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "บันทึกข้อมูล"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
}
