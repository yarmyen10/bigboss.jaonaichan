import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageSpinner from "../../components/common/PageSpinner";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import { AlertModal } from "../../components/ui/modal/AlertModal";
import type { Banner } from "../../interfaces/banner.jaonaichan";
import { getBanners, saveBanners, uploadBannerImage } from "../../services/jaonaichan";

// Spec: the designer's Banner Management package. The shop reads these banners (theme src/inc/woocommerce/shop-ux.php): only Active ones with a picture, in this order.

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const NO_IMAGE_TEXT = "ยังไม่ได้แนบรูป";
const DEFAULT_SECS = 5;

const fmtDate = (iso: string) => (iso ? new Date(iso) : new Date()).toLocaleDateString("en-GB");
const stem = (name: string) => name.replace(/\.[^.]+$/, "");
/** same rule as the server: empty, an http(s) URL or a site path ("/shop") */
const HEADING_MAX = 60;
const SUBHEADING_MAX = 120;
const CTA_MAX = 24;
/** the button goes to the Banner Link: a label without a link is refused (same rule as the server) */
const ctaNeedsLink = (b: Banner) => b.ctaLabel.trim() !== "" && b.link.trim() === "";
/** a heading is at most 2 lines */
const twoLines = (v: string) => v.replace(/\r/g, "").split("\n").slice(0, 2).join("\n");
/** an older server does not send the text fields */
const withText = (list: Banner[]): Banner[] => list.map(b => ({ ...b, heading: b.heading ?? "", subheading: b.subheading ?? "", ctaLabel: b.ctaLabel ?? "" }));
const linkOk = (l: string) => l.trim() === "" || /^https?:\/\/\S+$/i.test(l.trim()) || (l.trim().startsWith("/") && !l.trim().startsWith("//") && !/[\s<>"]/.test(l.trim()));

/** same rule as the server: 0 (the Shop slider does not move by itself) or a whole number of seconds, 2–60; null = not valid */
const secsOf = (v: string) => {
  const t = v.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n === 0 || (n >= 2 && n <= 60) ? n : null;
};

function newBanner(n: number): Banner {
  return { id: `new-${Math.random().toString(36).slice(2, 9)}`, title: `Banner ${n}`, description: NO_IMAGE_TEXT, isActive: false, image: null, link: "", heading: "", subheading: "", ctaLabel: "", updatedAt: new Date().toISOString() };
}

// ─── one card ────────────────────────────────────────────────────────────────

interface CardProps {
  banner: Banner;
  open: boolean;
  dirty: boolean;
  error: string;
  uploading: boolean;
  onToggleOpen: () => void;
  onChange: (patch: Partial<Banner>) => void;
  onFile: (file: File | undefined) => void;
  onToggleActive: (on: boolean) => void;
  onRemoveImage: () => void;
  onDelete: () => void;
}

function BannerCard({ banner: b, open, dirty, error, uploading, onToggleOpen, onChange, onFile, onToggleActive, onRemoveImage, onDelete }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.id });
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const bodyId = `banner-body-${b.id}`;
  const badLink = !linkOk(b.link);
  const badCta = ctaNeedsLink(b);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={b.title}
      className={`rounded-2xl border bg-white dark:bg-white/[0.03] ${isDragging ? "relative z-20 border-brand-300 shadow-lg" : "border-gray-200 dark:border-gray-800"}`}
    >
      <div className="flex items-start gap-3 p-4 sm:p-6">
        <button
          type="button"
          aria-label="ลากเพื่อจัดลำดับ"
          title="ลากเพื่อจัดลำดับ"
          className="mt-1 flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:hover:text-gray-300"
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
        </button>

        <button type="button" onClick={onToggleOpen} aria-expanded={open} aria-controls={bodyId} className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-800 dark:text-white/90">{b.title}</span>
              <Badge size="sm" color={b.isActive ? "success" : "light"}>{b.isActive ? "Active" : "Inactive"}</Badge>
              {dirty && <Badge size="sm" color="warning">มีการแก้ไข</Badge>}
            </span>
            <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
              {b.description || "—"} · อัปเดตล่าสุด {fmtDate(b.updatedAt)}
            </span>
          </span>
          <svg viewBox="0 0 24 24" className={`mt-1 h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6,9 12,15 18,9" /></svg>
        </button>
      </div>

      {open && (
        <div id={bodyId} className="space-y-6 border-t border-gray-100 p-4 dark:border-white/[0.05] sm:p-6">
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <label className="relative flex h-10 w-12 shrink-0 cursor-pointer items-center">   {/* 40px tall hit area around the 24px switch */}
              <input type="checkbox" role="switch" aria-label="สถานะแบนเนอร์" checked={b.isActive} onChange={e => onToggleActive(e.target.checked)} className="peer sr-only" />
              <span className="absolute left-0 top-1/2 h-6 w-11 -translate-y-1/2 rounded-full bg-gray-200 transition peer-checked:bg-success-500 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-500/30 dark:bg-white/10" />
              <span className="absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-theme-sm transition peer-checked:translate-x-5" />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">สถานะแบนเนอร์</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">เปิด/ปิดการแสดงบนหน้าเว็บ (Active ต้องแนบรูปด้วย)</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">รูปแบนเนอร์ <span className="text-error-500">*</span></p>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">แนะนำขนาด 2000×680 px (อัตราส่วน 1000:340 ตามที่แสดงในหน้า Shop) · JPG/PNG/WEBP · ไม่เกิน 2MB</p>
            <div
              data-drop-zone
              onDragEnter={e => { e.preventDefault(); setOver(true); }}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={e => { e.preventDefault(); setOver(false); }}
              onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
              className={`relative flex aspect-[1000/340] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
                error ? "border-error-500 bg-error-50 dark:bg-error-500/10" : over ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.02]"
              }`}
            >
              {b.image?.url ? (
                <img src={b.image.url} alt={b.image.name || b.title} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="px-4 text-center">
                  <svg viewBox="0 0 24 24" className="mx-auto mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17,8 12,3 7,8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">ลากไฟล์มาวางที่นี่</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">หรือ <button type="button" onClick={() => fileRef.current?.click()} className="font-medium text-brand-500 underline">เลือกไฟล์จากเครื่อง</button></p>
                </div>
              )}
              {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-gray-700 dark:bg-gray-900/70 dark:text-gray-200">กำลังอัปโหลด…</div>}
              {b.image?.url && !uploading && (
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <button type="button" onClick={onRemoveImage} className="h-10 rounded-lg bg-white px-4 text-sm font-medium text-error-600 shadow-theme-xs ring-1 ring-gray-200 hover:bg-gray-50">Remove</button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-lg bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs ring-1 ring-gray-200 hover:bg-gray-50">Change Image</button>
                </div>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT.join(",")} hidden data-file-input onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-error-600">{error}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">ข้อความบนแบนเนอร์ <span className="font-normal text-gray-400">(optional)</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400">แสดงซ้อนบนรูปในหน้า Shop · ข้อความสั้นอ่านง่ายบนมือถือ · ถ้ามีข้อความอยู่ในรูปแล้วไม่ต้องกรอก</p>
            </div>
            <div>
              <Label htmlFor={`heading-${b.id}`}>หัวข้อ</Label>
              <textarea
                id={`heading-${b.id}`}
                rows={2}
                maxLength={HEADING_MAX}
                value={b.heading}
                onChange={e => onChange({ heading: twoLines(e.target.value) })}
                placeholder="เช่น ติดต่อสอบถาม แอดมิน (ขึ้นบรรทัดใหม่ได้ 1 ครั้ง)"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90"
              />
            </div>
            <div>
              <Label htmlFor={`subheading-${b.id}`}>คำโปรย</Label>
              <Input id={`subheading-${b.id}`} maxLength={SUBHEADING_MAX} value={b.subheading} onChange={e => onChange({ subheading: e.target.value })} placeholder="เช่น มีคำถามเกี่ยวกับสินค้า? ทักได้เลย 24/7" />
            </div>
            <div>
              <Label htmlFor={`cta-${b.id}`}>ข้อความปุ่ม</Label>
              <Input id={`cta-${b.id}`} maxLength={CTA_MAX} value={b.ctaLabel} error={badCta} onChange={e => onChange({ ctaLabel: e.target.value })} placeholder="เช่น แชทกับเรา →" />
              {badCta
                ? <p role="alert" className="mt-2 text-sm text-error-600">ใส่ข้อความปุ่มได้เมื่อมี Banner Link — ปุ่มพาไปลิงก์นั้น</p>
                : <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ปุ่มพาไปที่ Banner Link · ถ้าเว้นว่าง ทั้งรูปจะกดไปที่ลิงก์</p>}
            </div>
          </div>

          <div>
            <label htmlFor={`link-${b.id}`} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Banner Link <span className="font-normal text-gray-400">(optional)</span></label>
            <div className="relative">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              <input
                id={`link-${b.id}`}
                type="text"
                inputMode="url"
                value={b.link}
                onChange={e => onChange({ link: e.target.value })}
                placeholder="https://example.com/path (optional)"
                aria-invalid={badLink}
                className={`h-11 w-full rounded-lg border bg-transparent pl-10 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:text-white/90 ${badLink ? "border-error-500 focus:ring-error-500/20" : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700"}`}
              />
            </div>
            {badLink && <p role="alert" className="mt-2 text-sm text-error-600">ลิงก์ต้องขึ้นต้นด้วย http(s):// หรือ / (เช่น /shop)</p>}
          </div>

          <div className="flex justify-end border-t border-dashed border-gray-200 pt-4 dark:border-gray-700">
            <button type="button" onClick={onDelete} className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-error-600 ring-1 ring-inset ring-error-200 hover:bg-error-50 dark:ring-error-500/30 dark:hover:bg-error-500/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              ลบ Banner นี้
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [saved, setSaved] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { kind: "delete"; id: string } | { kind: "discard" }>(null);
  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [secs, setSecs] = useState(String(DEFAULT_SECS));   // seconds between two slides on the Shop page (as typed)
  const [savedSecs, setSavedSecs] = useState(DEFAULT_SECS);
  const started = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getBanners();
      if (!res.success || !res.data) throw new Error(res.message || "load failed");
      setBanners(withText(res.data));
      setSaved(withText(res.data));
      const s = res.settings?.intervalSeconds ?? DEFAULT_SECS;
      setSecs(String(s));
      setSavedSecs(s);
      setOpenIds(new Set(res.data[0] ? [res.data[0].id] : []));   // the first card starts open, like the mock
      setErrors({});
    } catch (err) {
      setLoadError(true);
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // ── what changed since the last save (cards, deletions, order) ──
  const savedById = useMemo(() => new Map(saved.map(b => [b.id, b])), [saved]);
  const changedIds = useMemo(() => new Set(banners.filter(b => JSON.stringify(savedById.get(b.id)) !== JSON.stringify(b)).map(b => b.id)), [banners, savedById]);
  const deleted = saved.filter(s => !banners.some(b => b.id === s.id)).length;
  const kept = banners.filter(b => savedById.has(b.id)).map(b => b.id).join();
  const reordered = kept !== saved.filter(s => banners.some(b => b.id === s.id)).map(s => s.id).join();
  const secsNum = secsOf(secs);
  const badSecs = secsNum === null;
  const changes = changedIds.size + deleted + (reordered ? 1 : 0) + (secsNum !== savedSecs ? 1 : 0);
  const dirty = changes > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (id: string, p: Partial<Banner>) => { setJustSaved(false); setBanners(bs => bs.map(b => (b.id === id ? { ...b, ...p } : b))); };
  const setError = (id: string, msg: string, ms = 0) => {
    setErrors(e => ({ ...e, [id]: msg }));
    if (ms) setTimeout(() => setErrors(e => (e[id] === msg ? { ...e, [id]: "" } : e)), ms);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setJustSaved(false);
    setBanners(bs => arrayMove(bs, bs.findIndex(b => b.id === e.active.id), bs.findIndex(b => b.id === e.over!.id)));
  };

  const add = () => {
    const b = newBanner(banners.length + 1);
    setJustSaved(false);
    setBanners(bs => [...bs, b]);
    setOpenIds(o => new Set(o).add(b.id));
    requestAnimationFrame(() => document.querySelector(`[aria-label="${b.title}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const onFile = async (id: string, file: File | undefined) => {
    setError(id, "");
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setError(id, "รองรับเฉพาะไฟล์ JPG / PNG / WEBP");
    if (file.size > MAX_BYTES) return setError(id, "ขนาดไฟล์เกิน 2MB");
    setUploading(u => new Set(u).add(id));
    try {
      const res = await uploadBannerImage(file);
      if (!res.success || !res.url) return setError(id, res.message || "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
      patch(id, { image: { url: res.url, name: res.name || file.name }, description: stem(res.name || file.name) });
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setError(id, "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setUploading(u => { const n = new Set(u); n.delete(id); return n; });
    }
  };

  const toggleActive = (b: Banner, on: boolean) => {
    if (on && !b.image?.url) return setError(b.id, "กรุณาแนบรูปก่อนเปิด Active", 3000);   // the switch stays off: it is controlled by b.isActive
    patch(b.id, { isActive: on });
  };

  const save = async () => {
    if (secsNum === null) { document.getElementById("banner-interval")?.focus(); return; }   // the message under the field says what is wrong
    const badLink = banners.findIndex(b => !linkOk(b.link) || ctaNeedsLink(b));
    if (badLink >= 0) { setOpenIds(o => new Set(o).add(banners[badLink].id)); return; }
    setSaving(true);
    try {
      const res = await saveBanners(banners, { intervalSeconds: secsNum });
      if (!res.success || !res.data) { setResult({ variant: "error", message: res.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่" }); return; }
      const idMap = new Map(banners.map((b, i) => [b.id, res.data![i]?.id]));   // new-… ids became real ids: keep the cards open
      setOpenIds(o => new Set([...o].map(id => idMap.get(id) ?? id)));
      setBanners(withText(res.data));
      setSaved(withText(res.data));
      const s = res.settings?.intervalSeconds ?? secsNum;
      setSecs(String(s));
      setSavedSecs(s);
      setErrors({});
      setJustSaved(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setResult({ variant: "error", message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" });
    } finally {
      setSaving(false);
    }
  };

  const statusText = justSaved ? "บันทึกเรียบร้อย" : dirty ? `มีการเปลี่ยนแปลง ${changes} รายการที่ยังไม่ได้บันทึก` : "ยังไม่มีการเปลี่ยนแปลง";

  return (
    <>
      <PageMeta title="Banner Management | Jaonaichan Admin" description="Manage the promotion banners shown on the Shop page" />
      <PageBreadcrumb pageTitle="Banner Management" />
      {saving && <PageSpinner />}

      <div className="space-y-6">
        <p className="-mt-4 text-sm text-gray-500 dark:text-gray-400">จัดการแบนเนอร์โปรโมชั่นที่แสดงบนหน้า Shop</p>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white/90">แบนเนอร์ทั้งหมด</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">เพิ่ม/แก้ไข/สลับสถานะแบนเนอร์ ลากเพื่อจัดลำดับการแสดงผล</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled={loading} onClick={() => setConfirm({ kind: "discard" })}>↻ Reset</Button>
            <Button size="sm" disabled={loading || loadError} onClick={add}>＋ เพิ่ม Banner</Button>
          </div>
        </section>

        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">กำลังโหลดแบนเนอร์…</p>
        ) : loadError ? (
          <div className="py-12 text-center">
            <p className="mb-4 text-sm text-error-600">โหลดข้อมูลไม่สำเร็จ</p>
            <Button size="sm" onClick={() => void load()}>ลองใหม่</Button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-white/90">เวลาเปลี่ยนสไลด์</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">หน้า Shop เลื่อนไปแบนเนอร์ถัดไปเองทุกกี่วินาที (2–60) · ใส่ 0 = ไม่เลื่อนเอง ผู้เข้าชมกดลูกศรหรือจุดเอง</p>
                </div>
                <div>
                  <Label htmlFor="banner-interval" className="sr-only">เวลาเปลี่ยนสไลด์ (วินาที)</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-28">
                      <Input id="banner-interval" type="number" min="0" max="60" step={1} value={secs} error={badSecs} onChange={e => { setJustSaved(false); setSecs(e.target.value); }} />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">วินาที</span>
                  </div>
                  {badSecs && <p role="alert" className="mt-2 text-sm text-error-600">ใส่ 0 (ไม่เลื่อนเอง) หรือจำนวนเต็ม 2–60</p>}
                </div>
              </div>
            </section>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={banners.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div role="list" className="space-y-4">
                  {banners.map(b => (
                    <div role="listitem" key={b.id}>
                      <BannerCard
                        banner={b}
                        open={openIds.has(b.id)}
                        dirty={changedIds.has(b.id)}
                        error={errors[b.id] ?? ""}
                        uploading={uploading.has(b.id)}
                        onToggleOpen={() => setOpenIds(o => { const n = new Set(o); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })}
                        onChange={p => patch(b.id, p)}
                        onFile={f => void onFile(b.id, f)}
                        onToggleActive={on => toggleActive(b, on)}
                        onRemoveImage={() => patch(b.id, { image: null, isActive: false, description: NO_IMAGE_TEXT })}   // rule: active needs a picture
                        onDelete={() => setConfirm({ kind: "delete", id: b.id })}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {banners.length === 0 && <p className="py-8 text-center text-sm text-gray-500">ยังไม่มีแบนเนอร์ — กด "เพิ่ม Banner" เพื่อเริ่ม</p>}
            <button type="button" onClick={add} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300">
              ＋ เพิ่ม Banner ใหม่
            </button>
          </>
        )}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <p role="status" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dirty ? "bg-warning-500" : justSaved ? "bg-success-500" : "bg-gray-300"}`} />
            {statusText}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setConfirm({ kind: "discard" })}>Cancel</Button>
            <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>✓ Save Changes</Button>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        variant="error"
        title="ลบ Banner นี้ใช่ไหม?"
        message="แบนเนอร์จะถูกลบเมื่อกด Save Changes (รูปยังอยู่ในคลังสื่อของ WordPress)"
        confirmLabel="ลบ"
        cancelLabel="ยกเลิก"
        onConfirm={() => {
          if (confirm?.kind !== "delete") return;
          const id = confirm.id;
          setJustSaved(false);
          setBanners(bs => bs.filter(b => b.id !== id));
          setConfirm(null);
        }}
      />
      <AlertModal
        isOpen={confirm?.kind === "discard"}
        onClose={() => setConfirm(null)}
        variant="warning"
        title="ยกเลิกการเปลี่ยนแปลงทั้งหมด?"
        message="ข้อมูลจะกลับไปเป็นที่บันทึกไว้ล่าสุด"
        confirmLabel="ยกเลิกการเปลี่ยนแปลง"
        cancelLabel="กลับไปแก้ต่อ"
        onConfirm={() => { setConfirm(null); setJustSaved(false); void load(); }}
      />
      <AlertModal isOpen={result !== null} onClose={() => setResult(null)} variant={result?.variant ?? "success"} message={result?.message ?? ""} />
    </>
  );
}
