import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import { getCustomers, saveInvoice, getPromptPayQR, verifySlipForInvoice, patchInvoice } from "../../services/jaonaichan";
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
      const margin = 12;
      const contentW = pageW - 2 * margin;
      const imgH = (canvas.height * contentW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, margin - y, contentW, imgH);
        y += pageH - 2 * margin;
      }
      pdf.save(`${invoiceNumber}.pdf`);
    } finally {
      if (wasDark) html.classList.add("dark");
      setExporting(false);
    }
  }

  // Payment panel
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<"draft" | "sent" | "paid">("draft");

  // Mock send state
  const [sentFacebook, setSentFacebook] = useState(false);
  const [sentLine, setSentLine] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    getCustomers({ perPage: 100 })
      .then((res) => setCustomers(res.data))
      .finally(() => setCustLoading(false));
  }, []);

  useEffect(() => {
    if (savedId === null || total <= 0) return;
    setQrLoading(true);
    getPromptPayQR(total)
      .then((res) => setQrUrl(res.qr_url))
      .catch(() => setQrUrl(null))
      .finally(() => setQrLoading(false));
  }, [savedId, total]);

  useEffect(() => {
    return () => { if (slipPreview) URL.revokeObjectURL(slipPreview); };
  }, [slipPreview]);

  function handleSlipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    setSlipFile(file);
    setSlipPreview(file ? URL.createObjectURL(file) : null);
    setVerifyMsg(null);
  }

  async function handleVerify() {
    if (!slipFile || savedId === null || verifying) return;
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await verifySlipForInvoice(slipFile, total);
      setVerifyMsg({ success: res.success, message: res.message });
      if (res.success) {
        await patchInvoice(savedId, "paid");
        setInvoiceStatus("paid");
      }
    } catch {
      setVerifyMsg({ success: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setVerifying(false);
    }
  }

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
            className={`overflow-hidden ${exporting ? "rounded-none border-0 shadow-none" : "rounded-2xl border border-pink-200 dark:border-pink-900/40 shadow-theme-xs"}`}
          >
            {/* Dark header band */}
            <div
              className="px-8 py-6 flex items-center justify-between"
              style={{ background: "linear-gradient(90deg, rgb(255, 240, 246) 0%, rgb(252, 231, 243) 55%, rgb(253, 244, 255) 100%)" }}
            >
              <img
                src="/images/logo/jaonai_pastel_final.png"
                alt="Jaonaichan"
                className="h-20 w-auto object-contain"
              />
              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-widest text-pink-400 block mb-1">Invoice</span>
                <p className="font-mono text-sm font-semibold text-pink-500">#{invoiceNumber}</p>
                <p className="text-xs text-gray-500 mt-0.5">{invoiceDate}</p>
              </div>
            </div>

            {/* Accent line */}
            <div className="h-1" style={{ background: "linear-gradient(90deg, #f9a8d4 0%, #e879f9 55%, #c084fc 100%)" }} />

            {/* Paper content */}
            <div className="bg-white dark:bg-gray-900 p-6 md:p-10 space-y-8">

              {/* 3-col meta: Bill To / From / Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500 mb-1.5">Bill To</p>
                  {selectedCustomers.length > 0 ? (
                    selectedCustomers.map((c) => (
                      <div key={c.id} className="space-y-0.5">
                        <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                        {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                      </div>
                    ))
                  ) : (
                    !exporting && <p className="text-xs text-gray-400 dark:text-gray-500 italic">ยังไม่ได้เลือกผู้รับ</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500 mb-1.5">From</p>
                  <p className="font-medium text-gray-900 dark:text-white">Jaonaichan</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">jaonaichan.com</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500 mb-1.5">Invoice Details</p>
                  <p className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">#{invoiceNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{invoiceDate}</p>
                </div>
              </div>

              {/* Line items */}
              <div>
                {items.length === 0 && !exporting && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic py-4">ยังไม่มีรายการ — เพิ่มด้านล่าง</p>
                )}

                {items.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-pink-100 dark:border-pink-900/30">
                    <table className="w-full text-sm min-w-80">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-pink-800 dark:text-pink-200" style={{ background: "linear-gradient(90deg, rgb(255, 240, 246) 0%, rgb(252, 231, 243) 55%, rgb(253, 244, 255) 100%)" }}>
                          <th className="text-left px-4 py-3 font-semibold">ชื่อรายการ</th>
                          <th className="text-right px-4 py-3 font-semibold w-16">จำนวน</th>
                          <th className="text-right px-4 py-3 font-semibold w-28">ราคา/หน่วย</th>
                          <th className="text-right px-4 py-3 font-semibold w-28">รวม</th>
                          {!exporting && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-pink-50/40 dark:bg-pink-900/10"}>
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 border-b border-pink-100 dark:border-pink-900/20">{item.name}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 border-b border-pink-100 dark:border-pink-900/20">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 border-b border-pink-100 dark:border-pink-900/20">{fmt(item.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 border-b border-pink-100 dark:border-pink-900/20">{fmt(item.quantity * item.unitPrice)}</td>
                            {!exporting && (
                              <td className="px-4 py-3 text-center border-b border-pink-100 dark:border-pink-900/20">
                                <button onClick={() => removeItem(item.id)} className="text-pink-200 dark:text-pink-900 hover:text-red-500 transition-colors">✕</button>
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

              {/* Summary — bottom-right */}
              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-1">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 py-2 border-t border-pink-100 dark:border-pink-900/20">
                    <span>ยอดรวมสุทธิ</span>
                    <span>{fmt(total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-white px-4 py-2.5 rounded-lg font-bold text-sm" style={{ background: "linear-gradient(90deg, #f472b6 0%, #e879f9 55%, #a855f7 100%)" }}>
                    <span>TOTAL</span>
                    <span>{fmt(total)}</span>
                  </div>
                </div>
              </div>

              {/* Footer: notes + bank info */}
              <div className="pt-6 border-t border-pink-100 dark:border-pink-900/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    {!exporting ? (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500 block">หมายเหตุ</label>
                        <TextArea
                          value={notes}
                          onChange={setNotes}
                          placeholder="หมายเหตุเพิ่มเติม..."
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    ) : notes ? (
                      <div className="space-y-1">
                        <p className="font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500">หมายเหตุ</p>
                        <p className="text-gray-600 dark:text-gray-400">{notes}</p>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500 mb-1.5">ชำระเงิน</p>
                    <p className="text-gray-600 dark:text-gray-400">PromptPay พร้อมเพย์</p>
                    <p className="text-gray-400 dark:text-gray-500 mt-1">ขอบคุณที่ใช้บริการ Jaonaichan</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Right: Recipients + Payment panel ── */}
        <div className="xl:w-80 shrink-0 print:hidden space-y-4">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500">
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

          {/* ── Payment panel ── */}
        {savedId !== null && total > 0 && (
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-theme-xs p-5 space-y-4">
            {/* QR */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">PromptPay QR</p>
                {invoiceStatus === "paid" && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
                    ✓ ชำระแล้ว
                  </span>
                )}
              </div>
              {qrLoading ? (
                <div className="h-36 flex items-center justify-center text-gray-400 text-xs">
                  กำลังโหลด QR...
                </div>
              ) : qrUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={qrUrl} alt="PromptPay QR" className="w-36 h-36 object-contain rounded-lg" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{fmt(total)}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">โหลด QR ไม่ได้ — ตรวจสอบการตั้งค่า PromptPay</p>
              )}
            </div>

            {invoiceStatus !== "paid" && (
              <>
                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Slip upload */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 dark:text-pink-500">
                    ตรวจสอบสลิป
                  </p>

                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleSlipFile}
                    />
                    <div className={`
                      flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                      transition-colors min-h-24 text-center px-3
                      ${slipPreview
                        ? "border-brand-400 dark:border-brand-600"
                        : "border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-600"
                      }
                    `}>
                      {slipPreview ? (
                        <img
                          src={slipPreview}
                          alt="slip preview"
                          className="max-h-32 object-contain rounded-lg"
                        />
                      ) : (
                        <>
                          <span className="text-2xl">🧾</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            คลิกเพื่อเลือกรูปสลิป
                          </span>
                        </>
                      )}
                    </div>
                  </label>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!slipFile || verifying}
                    onClick={handleVerify}
                  >
                    {verifying ? "กำลังตรวจสอบ..." : "ตรวจสอบสลิป"}
                  </Button>

                  {verifyMsg && (
                    <p className={`text-xs text-center ${verifyMsg.success ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {verifyMsg.message}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </div>

    </>
  );
}
