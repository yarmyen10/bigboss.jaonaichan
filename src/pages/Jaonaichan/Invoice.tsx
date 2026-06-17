import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { getOrder, patchOrderInvoiceItems } from "../../services/jaonaichan";
import { OrderDetailResponse } from "../../interfaces/order.jaonaichan";
import type { InvoiceLineItem } from "../../interfaces/invoice.jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseAddressLines(raw: string): string[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 dark:text-white/90">{children}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // custom line items
  const [customItems, setCustomItems] = useState<InvoiceLineItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    const id = Number(orderId);
    if (!id) {
      setError("Invalid order ID");
      setLoading(false);
      return;
    }
    getOrder(id)
      .then((data) => {
        setOrder(data);
        if (data.invoice_items) {
          setCustomItems(data.invoice_items);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [orderId]);

  function addCustomItem() {
    const name = newName.trim();
    const qty = parseFloat(newQty);
    const price = parseFloat(newPrice);
    if (!name || isNaN(qty) || isNaN(price) || qty <= 0) return;
    setCustomItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, quantity: qty, unitPrice: price },
    ]);
    setNewName("");
    setNewQty("1");
    setNewPrice("");
  }

  function removeCustomItem(id: string) {
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function saveItems() {
    if (!order) return;
    setIsSaving(true);
    try {
      await patchOrderInvoiceItems(order.id, customItems);
      // Optional: add toast notification here
      console.log("Saved custom items successfully");
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setIsSaving(false);
    }
  }

  const orderTotal = order?.items.reduce((sum, item) => sum + item.total, 0) ?? 0;
  const customTotal = customItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const grandTotal = orderTotal + customTotal;

  const statusDetails = order ? ORDER_STATUS_DETAILS[order.status] : null;
  const addressLines = order ? parseAddressLines(order.billing.address) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-gray-400">Loading…</div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error ?? "Order not found"}</p>
        <Button size="sm" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Invoice — Order #${order.number}`} description={`Invoice for order #${order.number}`} />
      <PageBreadcrumb pageTitle={`Invoice #${order.number}`} />

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={saveItems} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Items"}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ── Invoice card ── */}
      <div
        id="invoice-printable"
        className="
          bg-white dark:bg-boxdark rounded-2xl border border-gray-200 dark:border-gray-700
          shadow-theme-xs p-6 md:p-10 space-y-8
          print:shadow-none print:border-0 print:rounded-none print:p-0
        "
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Invoice
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">#{order.number}</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            {statusDetails && (
              <Badge color={statusDetails.color}>{statusDetails.text}</Badge>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(order.date).toLocaleDateString("th-TH", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </span>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* Customer + Billing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Customer
            </p>
            <InfoBlock label="Name">{order.customer.name}</InfoBlock>
            <InfoBlock label="Email">{order.customer.email}</InfoBlock>
            {order.customer.phone && (
              <InfoBlock label="Phone">{order.customer.phone}</InfoBlock>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Billing Address
            </p>
            {addressLines.length > 0 ? (
              <div className="text-sm text-gray-800 dark:text-white/90 space-y-0.5">
                {addressLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* Items table */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Order Items
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 uppercase">
                <th className="text-left pb-2 font-medium">Item</th>
                <th className="text-right pb-2 font-medium w-16">Qty</th>
                <th className="text-right pb-2 font-medium w-28">Unit Price</th>
                <th className="text-right pb-2 font-medium w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items.map((item) => (
                <tr key={item.item_id}>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-gray-800 dark:text-white/90">{item.name}</p>
                    {item.variation.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.variation.map((v) => `${v.key}: ${v.value}`).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{fmt(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-800 dark:text-white/90">{fmt(item.total)}</td>
                </tr>
              ))}

              {/* custom items */}
              {customItems.map((item) => (
                <tr key={item.id} className="bg-blue-50/40 dark:bg-blue-900/10">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 dark:text-white/90">{item.name}</p>
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded print:hidden">
                        custom
                      </span>
                      <button
                        onClick={() => removeCustomItem(item.id)}
                        className="text-xs text-red-400 hover:text-red-600 print:hidden"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{fmt(item.unitPrice)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-800 dark:text-white/90">
                    {fmt(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add custom item row */}
          <div className="mt-4 flex flex-wrap gap-2 items-end print:hidden">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Item name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Shipping fee"
                className="
                  h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-brand-500
                  w-48
                "
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Qty</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="
                  h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-brand-500
                  w-20
                "
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Unit price (฿)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                className="
                  h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-brand-500
                  w-28
                "
              />
            </div>
            <Button size="sm" variant="outline" onClick={addCustomItem}>
              + Add item
            </Button>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Order subtotal</span>
              <span>{fmt(orderTotal)}</span>
            </div>
            {customTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Additional items</span>
                <span>{fmt(customTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
              <span>Total</span>
              <span>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body > *:not(#root) { display: none !important; }
          .print\\:hidden { display: none !important; }
          #invoice-printable { margin: 0; }
        }
      `}</style>
    </>
  );
}
