import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { CustomerListItem } from "../../interfaces/customer.jaonaichan";
import { Order as OrderIF } from "../../interfaces/order.jaonaichan";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { getCustomers, getCustomerOrders, createCustomer, updateCustomer, resetCustomerPassword, setCustomerStatus, importCustomers } from "../../services/jaonaichan";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/date-picker";
import OrderDetails from "../../components/jaonaichan/OrderDetails";
import ListCard from "../../components/jaonaichan/ListCard";
import { CalenderIcon, FileIcon, PlusIcon, SearchOneIcon } from "../../icons";

const PHONE_RE = /^0\d{8,9}$/;

interface ImportPreviewRow {
  row: number;
  username: string;
  customer_name: string;
  phone: string;
  valid: boolean;
  reason?: string;
}

// reads the first sheet, auto-detects Username/Name/Phone columns by header text
// (handles trailing spaces / EN-TH label variants), and fixes phone numbers that
// lost their leading 0 to Excel's number auto-formatting
async function parseImportFile(file: File): Promise<ImportPreviewRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (raw.length === 0) return [];

  const keys = Object.keys(raw[0]);
  const findKey = (...needles: string[]) =>
    keys.find((k) => needles.some((n) => k.trim().toLowerCase().includes(n)));

  const usernameKey = findKey("username");
  const nameKey = findKey("customer name", "ชื่อ");
  const phoneKey = findKey("phone", "เบอร์");

  return raw
    .map((r, i): ImportPreviewRow => {
      const username = String(usernameKey ? r[usernameKey] : "").trim();
      const customerName = String(nameKey ? r[nameKey] : "").trim();
      let phone = String(phoneKey ? r[phoneKey] : "").replace(/\D/g, "");
      if (phone.length === 9 && !phone.startsWith("0")) phone = "0" + phone;

      let reason: string | undefined;
      if (!username) reason = "ไม่มี Username";
      else if (!customerName) reason = "ไม่มีชื่อลูกค้า";
      else if (!PHONE_RE.test(phone)) reason = "เบอร์โทรศัพท์ไม่ถูกต้อง";

      return { row: i + 2, username, customer_name: customerName, phone, valid: !reason, reason };
    })
    .filter((r) => r.username || r.customer_name || r.phone); // drop blank padding rows
}

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

const formatDate = (val: string | null) => {
  if (!val) return null;
  const d = new Date(val);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// "YYYY-MM-DD" <-> Date, avoiding UTC-shift issues from Date.toISOString()/parsing
const isoToDate = (iso: string): Date | undefined => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};
const dateToIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const validateCustomerForm = (f: { username: string; customer_name: string; phone: string }) => {
  if (!f.username.trim() || f.username.length > 50) return "Username ต้องไม่เกิน 50 ตัวอักษร";
  if (!f.customer_name.trim() || f.customer_name.length > 100) return "ชื่อลูกค้าต้องไม่เกิน 100 ตัวอักษร";
  if (!PHONE_RE.test(f.phone.replace(/[-\s]/g, ""))) return "เบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง: 0812345678)";
  return null;
};

const getInitial = (name: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  const match = trimmed.match(/^[เแโใไ]?([ก-ฮA-Za-z0-9])/);
  return match ? match[1] : trimmed.charAt(0);
};

const StatusBadge = ({ status }: { status: 'active' | 'inactive' }) =>
  status === 'active' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Inactive
    </span>
  );

// member_date / last_order_date from backend are "YYYY-MM-DD HH:MM:SS" (MySQL datetime),
// lexically comparable against ISO "YYYY-MM-DD" — the picker displays dd/mm/yyyy but
// isoToDate/dateToIso keep the stored from/to values in ISO so string comparison still works
function DateRangeFields({
  idPrefix,
  label,
  from,
  to,
  onChange,
}: {
  idPrefix: string;
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="mb-2">
        <DatePicker
          id={`${idPrefix}-from`}
          placeholder="จาก"
          dateFormat="d/m/Y"
          defaultDate={isoToDate(from)}
          onChange={(dates) => onChange(dates[0] ? dateToIso(dates[0]) : "", to)}
        />
      </div>
      <div>
        <DatePicker
          id={`${idPrefix}-to`}
          placeholder="ถึง"
          dateFormat="d/m/Y"
          defaultDate={isoToDate(to)}
          onChange={(dates) => onChange(from, dates[0] ? dateToIso(dates[0]) : "")}
        />
      </div>
    </div>
  );
}

function DateFiltersPanel({
  memberFrom,
  memberTo,
  onMemberChange,
  lastOrderFrom,
  lastOrderTo,
  onLastOrderChange,
}: {
  memberFrom: string;
  memberTo: string;
  onMemberChange: (from: string, to: string) => void;
  lastOrderFrom: string;
  lastOrderTo: string;
  onLastOrderChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeCount = [!!memberFrom || !!memberTo, !!lastOrderFrom || !!lastOrderTo].filter(Boolean).length;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(".flatpickr-calendar")) return; // flatpickr popup mounts to document.body
      setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const btnRect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        variant={activeCount > 0 ? "primary" : "outline"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 font-medium transition"
        startIcon={<CalenderIcon className="size-5 shrink-0" />}
      >
        <span className="hidden sm:inline">ตัวกรองวันที่</span>
        {activeCount > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {open && btnRect && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: btnRect.bottom + 8,
            right: window.innerWidth - btnRect.right,
            zIndex: 9999,
          }}
          className="w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <DateRangeFields
            key={`member-date-${resetKey}`}
            idPrefix="member-date"
            label="วันที่สมัคร"
            from={memberFrom}
            to={memberTo}
            onChange={onMemberChange}
          />
          <div className="my-3 border-t border-gray-100 dark:border-white/[0.05]" />
          <DateRangeFields
            key={`last-order-date-${resetKey}`}
            idPrefix="last-order-date"
            label="Last Order"
            from={lastOrderFrom}
            to={lastOrderTo}
            onChange={onLastOrderChange}
          />
          {activeCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onMemberChange("", "");
                onLastOrderChange("", "");
                setResetKey((k) => k + 1);
              }}
              className="mt-3 w-full !py-2 text-xs"
            >
              ล้างตัวกรองทั้งหมด
            </Button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

const customerColumns: ColumnDef<CustomerListItem>[] = [
  {
    key: "username",
    label: "Username",
    sortable: true,
    render: (val) => (
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{val as string || "—"}</span>
    ),
  },
  {
    key: "name",
    label: "Customer Name",
    sortable: true,
    render: (_val, row) => (
      <div>
        <p className="text-sm font-medium text-black dark:text-white">{row.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{row.email}</p>
      </div>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (val) => (
      <span className="text-sm text-gray-700 dark:text-gray-300">{val as string || "—"}</span>
    ),
  },
  {
    key: "role",
    label: "Role",
    render: (val) => (
      <span className="text-sm text-gray-700 dark:text-gray-300">{val as string || "—"}</span>
    ),
  },
  {
    key: "order_count",
    label: "Orders",
    sortable: true,
    width: "90px",
    align: "left",
    render: (val) => (
      <span className="font-medium text-gray-800 dark:text-gray-200">{val as number}</span>
    ),
  },
  {
    key: "total_spend",
    label: "Total Spend",
    sortable: true,
    align: "left",
    render: (val) => (
      <span className="font-semibold text-black dark:text-white">
        ฿{Number(val).toLocaleString()}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (val) => <StatusBadge status={val as 'active' | 'inactive'} />,
  },
  {
    key: "member_date",
    label: "Member Date",
    sortable: true,
    width: "130px",
    render: (val) => {
      const d = formatDate(val as string | null);
      return d ? (
        <span className="text-sm font-light text-gray-700 dark:text-gray-400">{d}</span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      );
    },
  },
  {
    key: "last_order_date",
    label: "Last Order",
    sortable: true,
    width: "130px",
    render: (val) => {
      const d = formatDate(val as string | null);
      return d ? (
        <span className="text-sm font-light text-gray-700 dark:text-gray-400">{d}</span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      );
    },
  },
];

export default function Customers() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const hasInitialized = useRef(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderIF[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", customer_name: "", email: "", phone: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [isResetting, setIsResetting] = useState(false);
  const [resetMode, setResetMode] = useState<'idle' | 'phone' | 'manual'>('idle');
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const handleToggleStatus = async () => {
    if (!selectedCustomer || isTogglingStatus) return;
    const newStatus = selectedCustomer.status === 'active' ? 'inactive' : 'active';
    setIsTogglingStatus(true);
    try {
      const res = await setCustomerStatus(selectedCustomer.id, newStatus);
      if (res.success) {
        setSelectedCustomer(prev => prev ? { ...prev, status: newStatus } : null);
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, status: newStatus } : c));
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleResetPassword = async (mode: 'phone' | 'manual') => {
    if (!selectedCustomer) return;
    if (mode === 'manual' && resetPassword.length < 6) {
      setResetError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setResetError("");
    setIsResetting(true);
    try {
      const res = await resetCustomerPassword(selectedCustomer.id, {
        mode,
        ...(mode === 'manual' && { password: resetPassword }),
      });
      if (res.success) {
        setResetSuccess(res.message || "รีเซ็ตสำเร็จ");
        setResetMode('idle');
        setResetPassword("");
      } else {
        setResetError(res.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      setResetError(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsResetting(false);
    }
  };

  const [viewOrder, setViewOrder] = useState<OrderIF | null>(null);
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();

  const handleViewMore = useCallback((row: OrderIF) => {
    setViewOrder(row);
    openDetails();
  }, [openDetails]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", customer_name: "", email: "", phone: "", status: 'active' as 'active' | 'inactive' });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateCustomerForm(createForm);
    if (validationError) { setCreateError(validationError); return; }
    setCreateError("");
    setIsCreating(true);
    try {
      const res = await createCustomer(createForm);
      if (res.success) {
        setIsCreateOpen(false);
        setCreateForm({ username: "", customer_name: "", email: "", phone: "", status: 'active' });
        loadCustomers();
      } else {
        setCreateError(res.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      setCreateError(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const validationError = validateCustomerForm(editForm);
    if (validationError) { setUpdateError(validationError); return; }
    setUpdateError("");
    setIsUpdating(true);
    try {
      const res = await updateCustomer(selectedCustomer.id, editForm);
      if (res.success) {
        setIsEditing(false);
        setSelectedCustomer(prev => prev ? { ...prev, name: editForm.customer_name, username: editForm.username, email: editForm.email, phone: editForm.phone } : null);
        loadCustomers();
      } else {
        setUpdateError(res.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      setUpdateError(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsUpdating(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [importParseError, setImportParseError] = useState("");
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ created: number; skipped: { row: number; username: string; reason: string }[] } | null>(null);

  const closeImportModal = () => {
    setIsImportOpen(false);
    setImportRows([]);
    setImportResult(null);
    setImportParseError("");
    setImportProgress({ done: 0, total: 0 });
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    setImportParseError("");
    setImportResult(null);
    setIsParsingImport(true);
    setIsImportOpen(true);
    try {
      const rows = await parseImportFile(file);
      setImportRows(rows);
      if (rows.length === 0) setImportParseError("ไม่พบข้อมูลในไฟล์");
    } catch {
      setImportParseError("ไม่สามารถอ่านไฟล์นี้ได้ ตรวจสอบว่าเป็นไฟล์ .xlsx ที่ถูกต้อง");
    } finally {
      setIsParsingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter((r) => r.valid);
    if (validRows.length === 0 || isImporting) return;

    const CHUNK_SIZE = 100;
    let created = 0;
    const skipped: { row: number; username: string; reason: string }[] = [];

    setIsImporting(true);
    setImportProgress({ done: 0, total: validRows.length });
    try {
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const batch = validRows.slice(i, i + CHUNK_SIZE);
        const res = await importCustomers(batch.map((r) => ({
          username: r.username,
          customer_name: r.customer_name,
          phone: r.phone,
        })));
        if (res.data) {
          created += res.data.created;
          skipped.push(...res.data.skipped);
        }
        setImportProgress({ done: Math.min(i + CHUNK_SIZE, validRows.length), total: validRows.length });
      }
      setImportResult({ created, skipped });
      loadCustomers();
    } catch {
      setImportParseError("เกิดข้อผิดพลาดระหว่างนำเข้า กรุณาลองใหม่");
    } finally {
      setIsImporting(false);
    }
  };

  // backend caps per_page at 100 (customers_api.php) — fetch all pages upfront so
  // DataTableOne can paginate/search/sort client-side without refetching on every page turn
  const loadCustomers = async () => {
    const PER_PAGE = 100;
    try {
      setIsLoading(true);
      const first = await getCustomers({ page: 1, perPage: PER_PAGE });
      const all = Array.isArray(first?.data) ? [...first.data] : [];
      const totalPages = first?.pagination?.total_pages ?? 1;

      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => getCustomers({ page: i + 2, perPage: PER_PAGE }))
        );
        for (const r of rest) {
          if (Array.isArray(r?.data)) all.push(...r.data);
        }
      }

      setCustomers(all);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadCustomers();
  }, []);

  const handleRowClick = useCallback(async (customer: CustomerListItem) => {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    setIsEditing(false);
    setUpdateError("");
    setResetMode('idle');
    setResetPassword("");
    setResetError("");
    setResetSuccess("");

    setEditForm({
      username: customer.username || "",
      customer_name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
    });

    openModal();
    try {
      setIsOrdersLoading(true);
      const res = await getCustomerOrders(customer.id);
      setCustomerOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [openModal]);

  const columns = useMemo(() => customerColumns, []);

  const [memberDateFrom, setMemberDateFrom] = useState("");
  const [memberDateTo, setMemberDateTo] = useState("");
  const [lastOrderFrom, setLastOrderFrom] = useState("");
  const [lastOrderTo, setLastOrderTo] = useState("");

  const inRange = (val: string | null, from: string, to: string) => {
    if (!from && !to) return true;
    if (!val) return false;
    const d = val.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) =>
      inRange(c.member_date, memberDateFrom, memberDateTo) &&
      inRange(c.last_order_date, lastOrderFrom, lastOrderTo)
    );
  }, [customers, memberDateFrom, memberDateTo, lastOrderFrom, lastOrderTo]);

  // mobile card view (< min-[1025px]) has its own search box, independent of
  // DataTableOne's internal desktop search — see Customers.tsx plan notes
  const [mobileSearch, setMobileSearch] = useState("");
  const mobileFilteredCustomers = useMemo(() => {
    const q = mobileSearch.trim().toLowerCase();
    if (!q) return filteredCustomers;
    return filteredCustomers.filter((c) =>
      (c.username || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  }, [filteredCustomers, mobileSearch]);

  const CARD_PAGE_SIZE = 10;
  const [cardPage, setCardPage] = useState(1);
  useEffect(() => { setCardPage(1); }, [mobileFilteredCustomers]);
  const cardTotalPages = Math.max(1, Math.ceil(mobileFilteredCustomers.length / CARD_PAGE_SIZE));
  const pagedCustomers = mobileFilteredCustomers.slice((cardPage - 1) * CARD_PAGE_SIZE, cardPage * CARD_PAGE_SIZE);

  return (
    <>
      <PageMeta
        title="Customers | Bigboss Dashboard"
        description="Customer list with order history and spend stats"
      />
      <PageBreadcrumb pageTitle="Customers" />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportFileChange}
      />
      {/* Desktop table */}
      <div className="hidden min-[1025px]:block">
        <CardFrame isLoading={isLoading}>
          <DataTableOne<CustomerListItem>
            title="Customers"
            subtitle="ทะเบียนลูกค้าและสถิติการสั่งซื้อ"
            columns={columns}
            data={filteredCustomers}
            rowKey="id"
            searchable="header"
            exportable="header"
            onRowClick={handleRowClick}
            headerFilter={
              <div className="flex flex-wrap gap-2">
                <DateFiltersPanel
                  memberFrom={memberDateFrom}
                  memberTo={memberDateTo}
                  onMemberChange={(from, to) => { setMemberDateFrom(from); setMemberDateTo(to); }}
                  lastOrderFrom={lastOrderFrom}
                  lastOrderTo={lastOrderTo}
                  onLastOrderChange={(from, to) => { setLastOrderFrom(from); setLastOrderTo(to); }}
                />
                <Button size="sm" variant="outline" startIcon={<FileIcon className="size-5 shrink-0" />} onClick={() => fileInputRef.current?.click()}>
                  <span className="hidden sm:inline">นำเข้าจาก Excel</span>
                </Button>
                <Button size="sm" startIcon={<PlusIcon className="size-5 shrink-0" />} onClick={() => setIsCreateOpen(true)}>
                  <span className="hidden sm:inline">เพิ่มลูกค้าใหม่</span>
                </Button>
              </div>
            }
          />
        </CardFrame>
      </div>

      {/* Mobile/tablet card list */}
      <div className="min-[1025px]:hidden">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute z-1 top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              <SearchOneIcon />
            </span>
            <Input
              type="text"
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              placeholder="Search..."
              className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-11 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
          <DateFiltersPanel
            memberFrom={memberDateFrom}
            memberTo={memberDateTo}
            onMemberChange={(from, to) => { setMemberDateFrom(from); setMemberDateTo(to); }}
            lastOrderFrom={lastOrderFrom}
            lastOrderTo={lastOrderTo}
            onLastOrderChange={(from, to) => { setLastOrderFrom(from); setLastOrderTo(to); }}
          />
        </div>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" className="flex-1" startIcon={<FileIcon className="size-5 shrink-0" />} onClick={() => fileInputRef.current?.click()}>
            นำเข้าจาก Excel
          </Button>
          <Button size="sm" className="flex-1" startIcon={<PlusIcon className="size-5 shrink-0" />} onClick={() => setIsCreateOpen(true)}>
            เพิ่มลูกค้าใหม่
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-sm text-gray-400">Loading…</div>
        ) : mobileFilteredCustomers.length === 0 ? (
          <div className="flex justify-center py-12 text-sm text-gray-400">No customers found</div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {pagedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleRowClick(customer)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-colors active:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.02] dark:active:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-sm font-bold uppercase ring-1 ring-brand-500/20">
                        {getInitial(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">{customer.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{customer.username}</p>
                      </div>
                    </div>
                    <StatusBadge status={customer.status} />
                  </div>

                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{customer.phone || "—"}</p>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Orders: <span className="font-medium text-gray-800 dark:text-gray-200">{customer.order_count}</span></span>
                    <span className="font-semibold text-black dark:text-white">฿{Number(customer.total_spend).toLocaleString()}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>Member: {formatDate(customer.member_date) ?? "—"}</span>
                    <span>Last order: {formatDate(customer.last_order_date) ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
            {cardTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-xs text-gray-400">
                  {(cardPage - 1) * CARD_PAGE_SIZE + 1}–{Math.min(cardPage * CARD_PAGE_SIZE, mobileFilteredCustomers.length)} of {mobileFilteredCustomers.length}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={cardPage === 1}
                    onClick={() => setCardPage((p) => p - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.04]"
                  >
                    Prev
                  </button>
                  <button
                    disabled={cardPage === cardTotalPages}
                    onClick={() => setCardPage((p) => p + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.04]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-5xl m-4 w-full"
      >
        <div className="p-6">
          {selectedCustomer && (
            <>
              <div className="mb-5">
                {isEditing ? (
                  <form onSubmit={handleUpdateSubmit} className="space-y-4 pr-12 sm:pr-24">
                    {updateError && <div className="text-sm text-red-500">{updateError}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Username</label>
                        <Input required maxLength={50} disabled={isUpdating} value={editForm.username} onChange={e => setEditForm(p => ({...p, username: e.target.value}))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Customer Name</label>
                        <Input required maxLength={100} disabled={isUpdating} value={editForm.customer_name} onChange={e => setEditForm(p => ({...p, customer_name: e.target.value}))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">เบอร์โทรศัพท์</label>
                        <Input required maxLength={12} disabled={isUpdating} value={editForm.phone}
                          onChange={e => setEditForm(p => ({...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10)}))}
                          onFocus={() => setEditForm(p => ({...p, phone: p.phone.replace(/\D/g, "")}))}
                          onBlur={() => setEditForm(p => ({...p, phone: formatPhone(p.phone)}))}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">อีเมล</label>
                        <Input type="email" disabled={isUpdating} value={editForm.email} onChange={e => setEditForm(p => ({...p, email: e.target.value}))} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" disabled={isUpdating} onClick={(e) => { e.preventDefault(); setIsEditing(false); }}>ยกเลิก</Button>
                      <Button size="sm" onClick={handleUpdateSubmit} disabled={isUpdating}>{isUpdating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</Button>
                    </div>

                    {/* Reset Password */}
                    <div className="pt-4 border-t border-gray-100 dark:border-white/[0.05]">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">รีเซ็ตรหัสผ่าน</p>
                      {resetSuccess && <p className="text-xs text-green-600 dark:text-green-400 mb-2">{resetSuccess}</p>}
                      {resetError && <p className="text-xs text-red-500 mb-2">{resetError}</p>}
                      {resetMode === 'idle' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setResetMode('phone'); setResetError(""); setResetSuccess(""); }}>
                            ใช้เบอร์โทร
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetMode('manual'); setResetError(""); setResetSuccess(""); }}>
                            กรอกเอง
                          </Button>
                        </div>
                      )}
                      {resetMode === 'phone' && (
                        <div className="flex gap-2 items-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">รหัสผ่านใหม่ = <span className="font-medium text-gray-700 dark:text-gray-200">{editForm.phone.replace(/\D/g, "")}</span></p>
                          <Button size="sm" disabled={isResetting} onClick={() => handleResetPassword('phone')}>{isResetting ? "กำลังรีเซ็ต..." : "ยืนยัน"}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetMode('idle'); setResetError(""); }}>ยกเลิก</Button>
                        </div>
                      )}
                      {resetMode === 'manual' && (
                        <div className="flex gap-2 items-start">
                          <Input placeholder="รหัสผ่านใหม่ (≥6 ตัว)" value={resetPassword} onChange={e => setResetPassword(e.target.value)} disabled={isResetting} />
                          <Button size="sm" disabled={isResetting} onClick={() => handleResetPassword('manual')}>{isResetting ? "กำลังรีเซ็ต..." : "ยืนยัน"}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetMode('idle'); setResetPassword(""); setResetError(""); }}>ยกเลิก</Button>
                        </div>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pr-12 sm:pr-24">
                    <div className="flex items-center gap-5">
                      {/* Avatar */}
                      <div className="w-16 h-16 shrink-0 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-2xl font-bold uppercase ring-1 ring-brand-500/20">
                        {getInitial(selectedCustomer.name)}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                            {selectedCustomer.name}
                          </h4>
                          <StatusBadge status={selectedCustomer.status} />
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={handleToggleStatus}
                            disabled={isTogglingStatus}
                            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${
                              selectedCustomer.status === 'active'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20'
                            }`}
                          >
                            {isTogglingStatus ? "..." : selectedCustomer.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">@{selectedCustomer.username}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            {selectedCustomer.email}
                          </span>
                          {selectedCustomer.phone && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                              {selectedCustomer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-700/50">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Total Orders</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white leading-none">
                          {selectedCustomer.order_count}
                        </p>
                      </div>
                      <div className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20">
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-0.5">Total Spend</p>
                        <p className="text-lg font-bold text-brand-700 dark:text-brand-300 leading-none">
                          ฿{selectedCustomer.total_spend.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Order History</p>
                {isOrdersLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                ) : customerOrders.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No orders found</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                    {customerOrders.map((order) => (
                      <ListCard
                        key={order.id}
                        order={order}
                        compact
                        onView={handleViewMore}
                        onInvoice={(id) => navigate(`/jaonaichan/invoice/${id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        className="max-w-lg m-4 w-full"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">เพิ่มลูกค้าใหม่</h3>
            <p className="text-sm text-gray-500 mt-1">กรอกข้อมูลพื้นฐานเพื่อสร้างบัญชีลูกค้า (รหัสผ่านคือเบอร์โทรศัพท์)</p>
          </div>

          <div className="p-6 space-y-5">
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">Username *</label>
                <Input required placeholder="username" maxLength={50} disabled={isCreating} value={createForm.username} onChange={(e) => setCreateForm(prev => ({...prev, username: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">Customer Name *</label>
                <Input required placeholder="ชื่อลูกค้า" maxLength={100} disabled={isCreating} value={createForm.customer_name} onChange={(e) => setCreateForm(prev => ({...prev, customer_name: e.target.value}))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">เบอร์โทรศัพท์ (Phone) *</label>
              <Input required placeholder="081-234-5678" maxLength={12} value={createForm.phone}
                disabled={isCreating}
                onChange={(e) => setCreateForm(prev => ({...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 10)}))}
                onFocus={() => setCreateForm(prev => ({...prev, phone: prev.phone.replace(/\D/g, "")}))}
                onBlur={() => setCreateForm(prev => ({...prev, phone: formatPhone(prev.phone)}))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">อีเมล (Email)</label>
              <Input type="email" placeholder="example@email.com" disabled={isCreating} value={createForm.email} onChange={(e) => setCreateForm(prev => ({...prev, email: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">สถานะ</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setCreateForm(prev => ({...prev, status: 'active'}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${createForm.status === 'active' ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}
                >
                  Active
                </button>
                <button type="button"
                  onClick={() => setCreateForm(prev => ({...prev, status: 'inactive'}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${createForm.status === 'inactive' ? 'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-white/[0.05] flex justify-end gap-3 bg-gray-50/50 dark:bg-transparent rounded-b-2xl">
            <Button variant="outline" disabled={isCreating} onClick={(e) => { e.preventDefault(); setIsCreateOpen(false); }}>ยกเลิก</Button>
            <Button onClick={handleCreateSubmit} disabled={isCreating}>
              {isCreating ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isImportOpen}
        onClose={closeImportModal}
        className="max-w-lg m-4 w-full"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">นำเข้าลูกค้าจาก Excel</h3>

          {isParsingImport ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">กำลังอ่านไฟล์…</p>
          ) : importParseError ? (
            <div className="space-y-4">
              <p className="text-sm text-red-500">{importParseError}</p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={closeImportModal}>ปิด</Button>
              </div>
            </div>
          ) : importResult ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                นำเข้าสำเร็จ <span className="font-semibold text-green-600 dark:text-green-400">{importResult.created}</span> รายการ
                {importResult.skipped.length > 0 && (
                  <> · ข้าม <span className="font-semibold text-amber-600 dark:text-amber-400">{importResult.skipped.length}</span> รายการ</>
                )}
              </p>
              {importResult.skipped.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/[0.05]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">แถว</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Username</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">เหตุผล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {importResult.skipped.map((s) => (
                        <tr key={s.row}>
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{s.row}</td>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{s.username || "—"}</td>
                          <td className="px-3 py-1.5 text-red-500">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={closeImportModal}>ปิด</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                พบ <span className="font-semibold text-gray-900 dark:text-white">{importRows.length}</span> แถว —{" "}
                <span className="font-semibold text-green-600 dark:text-green-400">{importRows.filter((r) => r.valid).length}</span> รายการพร้อมนำเข้า
                {importRows.some((r) => !r.valid) && (
                  <>, <span className="font-semibold text-red-500">{importRows.filter((r) => !r.valid).length}</span> รายการมีปัญหา (จะถูกข้าม)</>
                )}
              </p>

              {importRows.some((r) => !r.valid) && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/[0.05]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">แถว</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Username</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">ปัญหา</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {importRows.filter((r) => !r.valid).map((r) => (
                        <tr key={r.row}>
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{r.row}</td>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.username || "—"}</td>
                          <td className="px-3 py-1.5 text-red-500">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isImporting ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  กำลังนำเข้า {importProgress.done}/{importProgress.total}…
                </p>
              ) : (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={closeImportModal}>ยกเลิก</Button>
                  <Button size="sm" disabled={importRows.filter((r) => r.valid).length === 0} onClick={handleConfirmImport}>
                    นำเข้า {importRows.filter((r) => r.valid).length} รายการ
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <OrderDetails
        order={viewOrder}
        isOpen={isDetailsOpen}
        onClose={closeDetails}
      />
    </>
  );
}
