import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { CustomerListItem } from "../../interfaces/customer.jaonaichan";
import { Order as OrderIF } from "../../interfaces/order.jaonaichan";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { getCustomers, getCustomerOrders, createCustomer, updateCustomer, resetCustomerPassword, setCustomerStatus } from "../../services/jaonaichan";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import OrderDetails from "../../components/jaonaichan/OrderDetails";
import ListCard from "../../components/jaonaichan/ListCard";

const PHONE_RE = /^0\d{8,9}$/;

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

const formatDate = (val: string | null) =>
  val ? new Date(val).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : null;

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

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await getCustomers();
      setCustomers(Array.isArray(res?.data) ? res.data : []);
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

  return (
    <>
      <PageMeta
        title="Customers | Bigboss Dashboard"
        description="Customer list with order history and spend stats"
      />
      <PageBreadcrumb pageTitle="Customers" />
      <CardFrame isLoading={isLoading}>
        <DataTableOne<CustomerListItem>
          title="Customers"
          subtitle="ทะเบียนลูกค้าและสถิติการสั่งซื้อ"
          columns={columns}
          data={customers}
          rowKey="id"
          searchable="header"
          exportable="header"
          onRowClick={handleRowClick}
          headerFilter={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              เพิ่มลูกค้าใหม่
            </Button>
          }
        />
      </CardFrame>

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

      <OrderDetails
        order={viewOrder}
        isOpen={isDetailsOpen}
        onClose={closeDetails}
      />
    </>
  );
}
