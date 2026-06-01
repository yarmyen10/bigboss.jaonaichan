import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import { getCustomers, saveInvoice } from "../../services/jaonaichan";
import type { CustomerListItem } from "../../interfaces/customer.jaonaichan";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import { CheckCircleIcon, Diskette, FileIcon, PlusIcon } from "../../icons";

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateInvoiceNumber() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `INV-${ymd}-${String(now.getTime()).slice(-4)}`;
}

// ── SendButton ─────────────────────────────────────────────────────────────

function SendButton({
  label,
  variant,
  disabled,
  sent,
  onClick,
}: {
  label: string;
  variant: "blue" | "green" | "orange";
  disabled: boolean;
  sent: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={variant} size="sm" className="w-full" disabled={disabled} onClick={onClick}>
      {sent ? "✓ ส่งแล้ว (mock)" : label}
    </Button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function InvoiceCreatorPage() {
  const [invoiceNumber] = useState(generateInvoiceNumber);
  const [invoiceDate] = useState(() =>
    new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" })
  );
  const [notes, setNotes] = useState("");

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  // Recipients
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [custLoading, setCustLoading] = useState(true);
  const [custSearch, setCustSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // PDF export
  const [exporting, setExporting] = useState(false);

  // Save to DB
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (saving || savedId !== null || items.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveInvoice({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        customer_ids: [...selected],
        items,
        total,
        notes,
        status: "draft",
      });
      setSavedId(res.data.id);
    } catch {
      setSaveError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  async function exportPDF() {
    const el = document.getElementById("invoice-printable");
    if (!el || exporting) return;
    setExporting(true);
    // wait for React to re-render (hiding form elements) before capturing
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    if (wasDark) html.classList.remove("dark");
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      // multi-page support if invoice is taller than one A4 page
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH);
        y += pageH;
      }
      pdf.save(`${invoiceNumber}.pdf`);
    } finally {
      if (wasDark) html.classList.add("dark");
      setExporting(false);
    }
  }

  // Mock send state
  const [sentFacebook, setSentFacebook] = useState(false);
  const [sentLine, setSentLine] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    getCustomers({ perPage: 100 })
      .then((res) => setCustomers(res.data))
      .finally(() => setCustLoading(false));
  }, []);

  // ── Line items ─────────────────────────────────────────────────────────

  function addItem() {
    const name = newName.trim();
    const qty = parseFloat(newQty);
    const price = parseFloat(newPrice);
    if (!name || isNaN(qty) || isNaN(price) || qty <= 0 || price < 0) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, quantity: qty, unitPrice: price },
    ]);
    setNewName("");
    setNewQty("1");
    setNewPrice("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // ── Recipients ─────────────────────────────────────────────────────────

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(custSearch.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const filteredIds = filtered.map((c) => c.id);
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  const selectedCustomers = customers.filter((c) => selected.has(c.id));
  const selectedEmails = selectedCustomers.map((c) => c.email).filter(Boolean);

  // ── Mock send ──────────────────────────────────────────────────────────

  function flashSent(setter: (v: boolean) => void) {
    setter(true);
    setTimeout(() => setter(false), 3000);
  }

  function handleFacebook() {
    flashSent(setSentFacebook);
  }

  function handleLine() {
    flashSent(setSentLine);
  }

  function handleEmail() {
    if (selectedEmails.length === 0) return;
    const subject = encodeURIComponent(`ใบแจ้งหนี้ ${invoiceNumber}`);
    const body = encodeURIComponent(
      `เรียน คุณลูกค้า\n\nกรุณาชำระเงินตาม Invoice ${invoiceNumber}\nยอดรวม: ${fmt(total)}\n\nขอบคุณครับ/ค่ะ`
    );
    window.open(`mailto:${selectedEmails.join(",")}?subject=${subject}&body=${body}`);
    flashSent(setSentEmail);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta title="Invoice / ใบแจ้งหนี้" description="สร้างและส่งใบแจ้งหนี้" />
      <div className="print:hidden">
        <PageBreadcrumb pageTitle="Invoice / ใบแจ้งหนี้" />
      </div>

      <div className="flex flex-col xl:flex-row gap-6 print:block">
        {/* ── Left: Invoice editor + printable ── */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-end items-center gap-2 mb-4 print:hidden">
            {saveError && (
              <span className="text-xs text-red-500">{saveError}</span>
            )}
            <Button
              size="sm"
              variant={savedId !== null ? "primary" : "outline"}
              startIcon={savedId !== null ? <CheckCircleIcon className="size-5" /> : <Diskette className="size-5" />}
              onClick={handleSave}
              disabled={saving || savedId !== null || items.length === 0}
            >
              {saving ? "กำลังบันทึก..." : savedId !== null ? "บันทึกแล้ว" : "บันทึก"}
            </Button>
            <Button size="sm" startIcon={<FileIcon className="size-5" />} onClick={exportPDF} disabled={exporting}>
              {exporting ? "กำลัง export..." : "Export PDF"}
            </Button>
          </div>

          <div
            id="invoice-printable"
            className="
              bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-gray-700
              shadow-theme-xs p-6 md:p-10 space-y-8
              print:shadow-none print:border-0 print:rounded-none print:p-0
            "
          >
            {/* Invoice header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice</h1>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">#{invoiceNumber}</p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 sm:text-right">
                <p className="font-medium text-gray-700 dark:text-gray-300">Jaonaichan</p>
                <p>{invoiceDate}</p>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Recipients — print only */}
            {selectedCustomers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  To
                </p>
                {selectedCustomers.map((c) => (
                  <p key={c.id} className="text-sm text-gray-800 dark:text-white/90">
                    {c.name}
                    {c.email ? ` — ${c.email}` : ""}
                  </p>
                ))}
              </div>
            )}
            {selectedCustomers.length > 0 && (
              <hr className="border-gray-200 dark:border-gray-700" />
            )}

            {/* Line items */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                รายการ
              </p>

              {items.length === 0 && !exporting && (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  ยังไม่มีรายการ — เพิ่มด้านล่าง
                </p>
              )}

              {items.length > 0 && (
                <div className="overflow-x-auto -mx-6 px-6 md:-mx-10 md:px-10">
                <table className="w-full text-sm min-w-80">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 uppercase">
                      <th className="text-left pb-2 font-medium">ชื่อรายการ</th>
                      <th className="text-right pb-2 font-medium w-16">จำนวน</th>
                      <th className="text-right pb-2 font-medium w-28">ราคา/หน่วย</th>
                      <th className="text-right pb-2 font-medium w-28">รวม</th>
                      {!exporting && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-white/90">
                          {item.name}
                        </td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                          {fmt(item.unitPrice)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-800 dark:text-white/90">
                          {fmt(item.quantity * item.unitPrice)}
                        </td>
                        {!exporting && (
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              {/* Add item row */}
              {!exporting && (
                <div className="mt-4 space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 dark:text-gray-500">ชื่อรายการ</label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem()}
                      placeholder="เช่น ค่าบริการออกแบบ"
                      className="sm:w-64"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400 dark:text-gray-500">จำนวน</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        value={newQty}
                        onChange={(e) => setNewQty(e.target.value)}
                        className="w-20"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                      <label className="text-xs text-gray-400 dark:text-gray-500">ราคา/หน่วย (฿)</label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addItem()}
                        placeholder="0.00"
                        className="sm:w-28"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      startIcon={<PlusIcon className="size-5 shrink-0" />}
                      className="relative"
                      onClick={addItem}
                    >
                      <span className="hidden sm:inline">เพิ่มรายการ</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Notes */}
            <div>
              {!exporting && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    หมายเหตุ
                  </label>
                  <TextArea
                    value={notes}
                    onChange={setNotes}
                    placeholder="หมายเหตุเพิ่มเติม..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}
              {exporting && notes && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    หมายเหตุ
                  </p>
                  <p className="text-sm text-gray-700 dark:text-white/90">{notes}</p>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-full sm:w-64">
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>ยอดรวม</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Recipients panel ── */}
        <div className="xl:w-80 shrink-0 print:hidden">
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-theme-xs p-5 space-y-4 xl:sticky xl:top-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">ผู้รับ</p>
              {selected.size > 0 && (
                <span className="text-xs px-2 py-0.5 bg-brand-50 text-brand-500 dark:bg-brand-900/30 dark:text-brand-400 rounded-full">
                  {selected.size} คน
                </span>
              )}
            </div>

            {/* Search */}
            <Input
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล..."
            />

            {/* Toggle all */}
            {filtered.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-brand-500 hover:underline">
                {allFilteredSelected
                  ? `ยกเลิกเลือก (${filtered.length})`
                  : `เลือกทั้งหมด (${filtered.length})`}
              </button>
            )}

            {/* Customer list */}
            <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-1 px-1">
              {custLoading ? (
                <p className="text-xs text-gray-400 text-center py-6">กำลังโหลด...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">ไม่พบลูกค้า</p>
              ) : (
                filtered.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => toggleSelect(c.id)}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Send buttons */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                ส่งให้ผู้รับ
              </p>
              {selected.size === 0 && (
                <p className="text-xs text-gray-400">เลือกผู้รับก่อนส่ง</p>
              )}
              <SendButton
                label="Facebook Message"
                variant="blue"
                disabled={selected.size === 0}
                sent={sentFacebook}
                onClick={handleFacebook}
              />
              <SendButton
                label="LINE Message"
                variant="green"
                disabled={selected.size === 0}
                sent={sentLine}
                onClick={handleLine}
              />
              <SendButton
                label="Email"
                variant="orange"
                disabled={selected.size === 0 || selectedEmails.length === 0}
                sent={sentEmail}
                onClick={handleEmail}
              />
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
