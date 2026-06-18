import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { CustomerListItem } from "../../interfaces/customer.jaonaichan";
import { Order as OrderIF } from "../../interfaces/order.jaonaichan";
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { getCustomers, getCustomerOrders, createCustomer, updateCustomer } from "../../services/jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import OrderDetails from "../../components/jaonaichan/OrderDetails";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";

const getInitial = (name: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  const match = trimmed.match(/^[เแโใไ]?([ก-ฮA-Za-z0-9])/);
  return match ? match[1] : trimmed.charAt(0);
};

const customerColumns: ColumnDef<CustomerListItem>[] = [
  {
    key: "name",
    label: "Customer",
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
    key: "last_order_date",
    label: "Last Order",
    sortable: true,
    width: "130px",
    render: (val) =>
      val ? (
        <span className="text-sm font-light text-gray-700 dark:text-gray-400">
          {new Date(val as string).toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      ),
  },
];

const getOrderHistoryColumns = (
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>,
  openDropdownId: string | null,
  setOpenDropdownId: (id: string | null) => void,
  handleViewMore: (row: OrderIF) => void,
  navigate: (to: string) => void
): ColumnDef<OrderIF>[] => [
  {
    key: "id",
    label: "Order #",
    width: "80px",
    render: (val) => (
      <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-400">#{val as string}</span>
    ),
  },
  {
    key: "date",
    label: "Date",
    width: "130px",
    render: (val) => (
      <span className="text-sm font-light text-gray-700 dark:text-gray-400">
        {new Date(val as string).toLocaleDateString("th-TH", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (val) => {
      const s = val as string;
      return (
        <span className="whitespace-nowrap">
          <Badge variant="gradient" color={(ORDER_STATUS_DETAILS[s]?.color ?? "light") as BadgeColor}>
            {ORDER_STATUS_DETAILS[s]?.text ?? s}
          </Badge>
        </span>
      );
    },
  },
  {
    key: "total",
    label: "Total",
    align: "left",
    render: (val) => (
      <span className="font-semibold text-black dark:text-white">
        ฿{Number(val).toLocaleString()}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    width: "80px",
    render: (_val, row) => {
      const isOpen = openDropdownId === String(row.id);
      const btnRect = buttonRefs.current[row.id]?.getBoundingClientRect();
      return (
        <div className="relative flex justify-end">
          <button
            ref={(el) => { buttonRefs.current[row.id] = el; }}
            className="dropdown-toggle"
            onClick={() => setOpenDropdownId(isOpen ? null : String(row.id))}
          >
            <MoreDotIcon className="rotate-90 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
          </button>
          {isOpen && btnRect && createPortal(
            <div
              style={{
                position: 'fixed',
                top: btnRect.bottom,
                left: btnRect.right,
                zIndex: 999999,
              }}
            >
              <Dropdown
                isOpen={isOpen}
                onClose={() => setOpenDropdownId(null)}
                className="w-40 p-2"
              >
                <DropdownItem
                  onItemClick={() => { setOpenDropdownId(null); handleViewMore(row); }}
                  className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  View More
                </DropdownItem>
                <DropdownItem
                  onItemClick={() => { setOpenDropdownId(null); navigate(`/jaonaichan/invoice/${row.id}`); }}
                  className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  Invoice
                </DropdownItem>
              </Dropdown>
            </div>,
            document.body
          )}
        </div>
      );
    },
  },
];

export default function Customers() {
  const navigate = useNavigate();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const hasInitialized = useRef(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderIF[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [viewOrder, setViewOrder] = useState<OrderIF | null>(null);
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();

  const handleViewMore = useCallback((row: OrderIF) => {
    setViewOrder(row);
    openDetails();
  }, [openDetails]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", first_name: "", last_name: "", phone: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsCreating(true);
    try {
      const res = await createCustomer(createForm);
      if (res.success) {
        setIsCreateOpen(false);
        setCreateForm({ email: "", first_name: "", last_name: "", phone: "" });
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
    setUpdateError("");
    setIsUpdating(true);
    try {
      const res = await updateCustomer(selectedCustomer.id, editForm);
      if (res.success) {
        setIsEditing(false);
        const newName = `${editForm.first_name} ${editForm.last_name}`.trim();
        setSelectedCustomer(prev => prev ? { ...prev, name: newName, email: editForm.email, phone: editForm.phone } : null);
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
    
    const nameParts = customer.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    setEditForm({
      first_name: firstName,
      last_name: lastName,
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
  const orderCols = useMemo(
    () => getOrderHistoryColumns(buttonRefs, openDropdownId, setOpenDropdownId, handleViewMore, navigate),
    [openDropdownId, handleViewMore, navigate]
  );

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
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">ชื่อ</label>
                        <Input required value={editForm.first_name} onChange={e => setEditForm(p => ({...p, first_name: e.target.value}))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">นามสกุล</label>
                        <Input required value={editForm.last_name} onChange={e => setEditForm(p => ({...p, last_name: e.target.value}))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">เบอร์โทรศัพท์</label>
                        <Input required value={editForm.phone} onChange={e => setEditForm(p => ({...p, phone: e.target.value}))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">อีเมล</label>
                        <Input type="email" value={editForm.email} onChange={e => setEditForm(p => ({...p, email: e.target.value}))} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); setIsEditing(false); }}>ยกเลิก</Button>
                      <Button size="sm" onClick={handleUpdateSubmit} disabled={isUpdating}>{isUpdating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</Button>
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
                        <div className="flex items-center gap-3 mb-1.5">
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                            {selectedCustomer.name}
                          </h4>
                          <button 
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                          >
                            แก้ไข
                          </button>
                        </div>
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

              <DataTableOne<OrderIF>
                title="Order History"
                columns={orderCols}
                data={customerOrders}
                rowKey="id"
                scrollable
                scrollMaxHeight={320}
                loading={isOrdersLoading}
              />
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
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              เพิ่มลูกค้าใหม่
            </h3>
            <p className="text-sm text-gray-500 mt-1">กรอกข้อมูลพื้นฐานเพื่อสร้างบัญชีลูกค้า (รหัสผ่านคือเบอร์โทรศัพท์)</p>
          </div>
          
          {/* Body */}
          <div className="p-6 space-y-5">
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {createError}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">เบอร์โทรศัพท์ (Phone) *</label>
              <Input required placeholder="08x-xxx-xxxx" value={createForm.phone} onChange={(e) => setCreateForm(prev => ({...prev, phone: e.target.value}))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">ชื่อ (First Name) *</label>
                <Input required placeholder="ชื่อ" value={createForm.first_name} onChange={(e) => setCreateForm(prev => ({...prev, first_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">นามสกุล (Last Name) *</label>
                <Input required placeholder="นามสกุล" value={createForm.last_name} onChange={(e) => setCreateForm(prev => ({...prev, last_name: e.target.value}))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-gray-700 dark:text-gray-300">อีเมล (Email)</label>
              <Input type="email" placeholder="example@email.com" value={createForm.email} onChange={(e) => setCreateForm(prev => ({...prev, email: e.target.value}))} />
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-white/[0.05] flex justify-end gap-3 bg-gray-50/50 dark:bg-transparent rounded-b-2xl">
            <Button variant="outline" onClick={(e) => { e.preventDefault(); setIsCreateOpen(false); }}>ยกเลิก</Button>
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
