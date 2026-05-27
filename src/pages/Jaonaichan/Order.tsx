import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import flatpickr from "flatpickr";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { OrderListResponse, Order as OrderIF, OrderProductsBulkResponse, OrderItemProduct, OrderProductsBulkItem } from "../../interfaces/order.jaonaichan"
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import { getOrders, getProductsBulkByOrders, patchBill2, patchOrderStatus } from "../../services/jaonaichan";
import { resolveManageTabs, hasManageableOrders, STATUS_MANAGE_ACTIONS } from "../../config/manageOrders.jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";
import { TabOption } from "../../components/ui/tabs";
import { CalenderIcon, CheckCircleIcon, MoreDotIcon } from "../../icons";
import Button from "../../components/ui/button/Button";
import Select from "../../components/form/Select";
import Label from "../../components/form/Label";
import { BulkActionsDropdown, DropdownSectionHeader } from "../../components/ui/dropdown/BulkActionsDropdown";
import { Modal } from "../../components/ui/modal";
import { AlertModal } from "../../components/ui/modal/AlertModal";
import { useModal } from "../../hooks/useModal";

import { useSpinner } from "../../hooks/useSpinner";
import PageSpinner from "../../components/common/PageSpinner";
import ComponentTabCard from "../../components/common/ComponentTabCard";
import ProductDetailsCard from "../../components/jaonaichan/ProductDetailsCard";
import OrderDetails from "../../components/jaonaichan/OrderDetails";
import BottomSheet from "../../components/ui/bottom-sheet/BottomSheet";



type PaymentMethod = "promptpay_qr" | "bank_transfer" | "cod";
// interface WCOrder {
//   id: number;
//   number: string;
//   status: OrderStatus;
//   date_created: string;
//   billing: { first_name: string; last_name: string; email: string };
//   total: string;
//   payment_method_title: string;
// }

interface Details {
  color: BadgeColor;
  text: string;
  icon?: React.ReactNode;
  [key: string]: unknown;
}


const PAYMENT_METHOD_DETAILS: Record<PaymentMethod, Details> = {
  "promptpay_qr": {
    color: "primary",
    text: "PromptPay QR",
    icon: <img src="/images/order/prompt-pay-logo.jpg" className="object-cover" />
  },
  "bank_transfer": { color: "info", text: "Bank Transfer" },
  "cod": { color: "light", text: "Cash on Delivery" },
};

// ── Tab → status mapping ──────────────────────────────────────────────────────

const TAB_STATUS: Record<string, string | undefined> = {
  all:    undefined,
  unpaid: "waiting-transfer,pending-payment-1,wait-verify-1,pending-payment-2,wait-verify-2",
  paid:   "paid-1,paid-2,completed",
};

// ── Date filter ──────────────────────────────────────────────────────────────

interface DateFilter {
  month: string;  // "" = All, "1"–"12"
  year: string;   // "yyyy"
  date: string;   // "" = no day override, "dd/mm/yyyy"
}


function parseDMY(s: string): Date | undefined {
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : undefined;
}

const MONTHS = [
  { label: "All", value: "" },
  { label: "January", value: "1" },
  { label: "February", value: "2" },
  { label: "March", value: "3" },
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "June", value: "6" },
  { label: "July", value: "7" },
  { label: "August", value: "8" },
  { label: "September", value: "9" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

function DateFilterDropdown({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (fpRef.current?.calendarContainer?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // re-init flatpickr each time the panel mounts so defaultDate reflects current value
  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      mode: "single",
      dateFormat: "d/m/Y",
      defaultDate: parseDMY(valueRef.current.date) ?? new Date(),
      monthSelectorType: "static",
      prevArrow:
        '<svg class="stroke-current" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      nextArrow:
        '<svg class="stroke-current" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7.5 15L12.5 10L7.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      onChange: (_dates, dateStr) => {
        onChangeRef.current({ ...valueRef.current, date: dateStr });
      },
    });
    fpRef.current = Array.isArray(fp) ? fp[0] : fp;
    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [open]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const isFiltered = value.date !== "" || value.month !== "" || value.year !== String(currentYear);
  const btnRect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        variant={isFiltered ? "primary" : "outline"}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 font-medium transition`}
        startIcon={<CalenderIcon className="size-5 shrink-0" />}
        endIcon={isFiltered && (<CheckCircleIcon className="size-5 shrink-0" />)}
      >
        <span className="hidden sm:inline">Date</span>
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
          {/* Year */}
          <div className="mb-3">
            <Label>Year</Label>
            <Select
              key={value.year}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              placeholder={null}
              defaultValue={value.year}
              onChange={(val) => onChange({ ...value, year: val })}
            />
          </div>

          {/* Month */}
          <div className="mb-3">
            <Label>Month</Label>
            <Select
              key={value.month}
              options={MONTHS.map((m) => ({ value: m.value, label: m.label }))}
              placeholder={null}
              defaultValue={value.month}
              onChange={(val) => onChange({ ...value, month: val, date: "" })}
            />
          </div>

          {/* Date */}
          <div className="mb-1">
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Date</Label>
              {value.date && (
                <button
                  type="button"
                  onClick={() => { fpRef.current?.clear(); onChange({ ...value, date: "" }); }}
                  className="text-xs text-gray-400 transition-colors hover:text-red-500 dark:hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <CalenderIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                readOnly
                placeholder="dd/mm/yyyy"
                className="h-9 w-full cursor-pointer rounded-lg border border-gray-300 bg-transparent pl-9 pr-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Reset all */}
          {isFiltered && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fpRef.current?.clear(); onChange({ month: "", year: String(currentYear), date: "" }); }}
              className="mt-3 w-full !py-2 text-xs"
            >
              Reset filters
            </Button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

const getOrderColumns = (
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>,
  openDropdownId: string | null,
  setOpenDropdownId: (id: string | null) => void,
  onViewMore: (row: OrderIF) => void
): ColumnDef<OrderIF>[] => [
    {
      key: "id",
      label: "Order #",
      sortable: true,
      width: "80px",
      render: (val) => <span className="text-theme-xs font-medium text-gray-700 group-hover:underline dark:text-gray-400">#{val as string}</span>,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      width: "130px",
      render: (val) => (
        <span className="text-sm font-light text-gray-700 dark:text-gray-400">
          {new Date(val as string).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      noExport: true,
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-black dark:text-white">
            {row.customer.name}
          </p>
          <p className="text-xs text-body text-gray-400 dark:text-gray-500">{row.customer.email}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "180px",
      render: (val) => {
        const s = val as string;
        return (
          <span className="whitespace-nowrap">
            <Badge variant="gradient" color={((ORDER_STATUS_DETAILS[s]?.color ?? 'light') as BadgeColor)}>
              {ORDER_STATUS_DETAILS[s]?.text ?? s}
            </Badge>
          </span>
        );
      },
    },
    {
      key: "payment_method",
      label: "Payment Method",
      // classNameTableCell: "py-0",
      width: "0",
      render: (val) => {
        const pm = val as PaymentMethod;
        return (
          <span title={PAYMENT_METHOD_DETAILS[pm]?.text ?? pm}>{PAYMENT_METHOD_DETAILS[pm]?.icon ?? pm}</span>
          // <Badge variant="light" color={((PAYMENT_METHOD_DETAILS[pm]?.color ?? 'light') as BadgeColor)}>
          //   { PAYMENT_METHOD_DETAILS[pm]?.text ?? pm }
          // </Badge>
        );
      },
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      align: "left",
      render: (val) => (
        <span className="font-semibold text-black dark:text-white">
          ฿{Number(val).toLocaleString()}
        </span>
      ),
    },
    {
      key: "progress",
      label: "Progress",
      width: "130px",
      noExport: true,
      render: (_val, row) => {
        const b1 = row.bill1?.status === "paid";
        const b2 = row.bill2?.status === "paid";
        const pct = b2 ? 100 : b1 ? 50 : 0;
        const barColor = pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600";
        return (
          <div className="flex flex-col gap-1.5 min-w-[100px]">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {b2 ? "2/2" : b1 ? "1/2" : "0/2"}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "action",
      label: "",
      width: "80px",
      render: (_val, row) => {
        const isOpen = openDropdownId === String(row.id);
        const btnRect = buttonRefs.current[row.id]?.getBoundingClientRect();
        return (
          <div className="relative">
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
                  zIndex: 9999,
                }}
              >
                <Dropdown
                  isOpen={isOpen}
                  onClose={() => setOpenDropdownId(null)}
                  className="w-40 p-2"
                >
                  <DropdownItem
                    onItemClick={() => { setOpenDropdownId(null); onViewMore(row); }}
                    className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    View More
                  </DropdownItem>
                  <DropdownItem
                    onItemClick={() => setOpenDropdownId(null)}
                    className="flex w-full font-normal text-left text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-white/5 dark:hover:text-red-300"
                  >
                    Delete
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


const getManageOrderColumns = (
  unitPrices: Record<number, string>,
  setUnitPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  setSelectedProductId: React.Dispatch<React.SetStateAction<number | null>>
): ColumnDef<OrderItemProduct>[] => [
    {
      key: "name",
      label: "Product",
      sortable: true,
      // width: "1000px",
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <img
            src={row.image?.thumbnail ?? row.image?.medium ?? ""}
            alt={row.name}
            className="h-10 w-10 shrink-0 rounded object-cover bg-gray-100 dark:bg-gray-800"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">{val as string}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{row.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      // width: "1000px",
      render: (val) => (
        <span className="font-semibold text-black dark:text-white">
          ฿{Number(val).toLocaleString()}
        </span>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      sortable: true,
      // width: "1000px",
      render: (val, row) => (
        val !== null
          ? <span className="text-sm text-gray-700 dark:text-gray-300">{val as number}</span>
          : <Badge variant="light" color="light">{row.stock_status}</Badge>
      ),
    },
    {
      key: "unit_price",
      label: "Unit Price",
      width: "150px",
      noExport: true,
      render: (_val, row) => {
        const value = unitPrices[row.id] ?? "";
        return (
          <div
            className="relative w-full min-w-[150px]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              ฿
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={value}
              onFocus={() => setSelectedProductId(row.id)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, "");
                const parts = raw.split(".");
                const next = parts.length > 1
                  ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
                  : raw;
                setUnitPrices((prev) => {
                  if (next === "") {
                    const { [row.id]: _removed, ...rest } = prev;
                    return rest;
                  }
                  return { ...prev, [row.id]: next };
                });
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
        );
      },
    },

  ];

export default function Order() {
  const { spinning, withSpinner } = useSpinner(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [orders, setOrders] = useState<OrderIF[]>([]);

  const [dateFilter, setDateFilter] = useState<DateFilter>(() => ({
    month: "",
    year: String(new Date().getFullYear()),
    date: "",
  }));

  const [statusTab, setStatusTab] = useState<string>("all");

  const [products, setProducts] = useState<OrderItemProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const selectedProduct = products.find(p => p.id === selectedProductId) ?? null;

  const [sheetProductId, setSheetProductId] = useState<number | null>(null);
  const sheetProduct = products.find(p => p.id === sheetProductId) ?? null;

  const [unitPrices, setUnitPrices] = useState<Record<number, string>>({});

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [viewOrder, setViewOrder] = useState<OrderIF | null>(null);
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleViewMore = useCallback((row: OrderIF) => {
    setViewOrder(row);
    openDetails();
  }, [openDetails]);

  const columns = useMemo(
    () => getOrderColumns(buttonRefs, openDropdownId, setOpenDropdownId, handleViewMore),
    [openDropdownId, handleViewMore]
  );

  const manageOrdersColumns = useMemo(
    () => getManageOrderColumns(unitPrices, setUnitPrices, setSelectedProductId),
    [unitPrices]
  );

  const loadOrders = async (filter: DateFilter, tab: string = statusTab) => {
    try {
      setIsLoading(true);
      const res: OrderListResponse = await getOrders({
        ...(filter.date
          ? { createDate: filter.date }
          : {
            ...(filter.month ? { createDateM: Number(filter.month) } : {}),
            ...(filter.year ? { createDateY: Number(filter.year) } : {}),
          }),
        ...(TAB_STATUS[tab] ? { status: TAB_STATUS[tab] } : {}),
      });
      setOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  };

  const handleFilterChange = (newFilter: DateFilter) => {
    setDateFilter(newFilter);
    loadOrders(newFilter);
  };

  const handleTabChange = (tab: string) => {
    setStatusTab(tab);
    loadOrders(dateFilter, tab);
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadOrders(dateFilter);
  }, []);

  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: isAlertOpen, openModal: openAlert, closeModal: closeAlert } = useModal();
  const [manageOrdersTabs, setManageOrdersTabs] = useState([] as TabOption[]);
  const [manageOrderItems, setManageOrderItems] = useState<OrderProductsBulkItem[]>([]);
  const [activeManageTab, setActiveManageTab] = useState<string>("");
  const initialManageOrders = (selectedOrders: OrderIF[]) => {
    withSpinner(async () => {
      const orderIds = selectedOrders.map(o => o.id);
      const res: OrderProductsBulkResponse = await getProductsBulkByOrders({ orderIds });

      const manageable = (res?.data ?? []).filter(item =>
        (STATUS_MANAGE_ACTIONS[item.status]?.length ?? 0) > 0 && !item.bill2.unit_prices_id
      );
      if (manageable.length === 0) { openAlert(); return; }
      setManageOrderItems(manageable);

      const uniqueProducts = new Map<number, OrderItemProduct>();
      for (const item of manageable) {
        if (!uniqueProducts.has(item.product.id)) {
          uniqueProducts.set(item.product.id, item.product);
        }
      }
      setProducts(Array.from(uniqueProducts.values()));

      const tabs = resolveManageTabs(selectedOrders);
      setManageOrdersTabs(tabs);
      setActiveManageTab(tabs[0]?.value ?? "");
      setUnitPrices({});
    });
    openModal();
  }

  const handleSaveOrders = () => {
    withSpinner(async () => {
      if (activeManageTab === "bill2") {
        const numericPrices: Record<number, number> = {};
        for (const [pid, raw] of Object.entries(unitPrices)) {
          const price = parseFloat(raw) || 0;
          if (price > 0) numericPrices[Number(pid)] = price;
        }
        const now = new Date();
        const p = (n: number, l = 2) => String(n).padStart(l, '0');
        const batchId = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
        const orderItemsMap = new Map<number, typeof manageOrderItems>();
        for (const item of manageOrderItems) {
          if (!orderItemsMap.has(item.id)) orderItemsMap.set(item.id, []);
          orderItemsMap.get(item.id)!.push(item);
        }
        await Promise.all(
          Array.from(orderItemsMap.entries()).map(async ([orderId, items]) => {
            const orderPrices: Record<number, number> = {};
            let total = 0;
            for (const item of items) {
              const price = numericPrices[item.product.id] ?? 0;
              if (price > 0) orderPrices[item.product.id] = price;
              total += price * item.quantity;
            }
            await patchBill2(orderId, total, 'pending', undefined, orderPrices, batchId);
            await patchOrderStatus(orderId, 'wc-pending-payment-2');
          })
        );
      }
      closeModal();
      loadOrders(dateFilter);
    });
  }

  if (spinning) {
    return <PageSpinner />;
  }

  return (
    <>
      <PageMeta
        title="Order Dashboard | Admin Dashboard Template"
        description="This is Order Dashboard page for Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Order Jaonaichan" />
      <CardFrame isLoading={isLoading}>
        <DataTableOne<OrderIF>
          title="Orders"
          subtitle="Manage and track all customer orders."
          columns={columns}
          data={orders}
          rowKey="id"
          selectable
          searchable="header"
          exportable="header"
          headerFilter={<DateFilterDropdown value={dateFilter} onChange={handleFilterChange} />}
          tabs={[
            { value: "all", label: "All Order" },
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
          ] as TabOption[]}
          tabValue={statusTab}
          onTabChange={handleTabChange}
          // filters={[{
          //   label: "Stock Status",
          //   paramKey: "stock_status",
          //   options: [
          //     { label: "All", value: "" },
          //     { label: "In Stock", value: "instock" },
          //     { label: "Out of Stock", value: "outofstock" },
          //     { label: "Backorder", value: "onbackorder" },
          //   ],
          // }]}
          bulkActions={(selected, isAllSelected) => (
            <BulkActionsDropdown label="Actions">
              {(close) => (
                <>
                  {hasManageableOrders(selected.map(o => o.status)) && (
                    <>
                      <DropdownSectionHeader label="Manage" />
                      {isAllSelected && hasManageableOrders(orders.map(o => o.status)) && (
                        <DropdownItem onItemClick={() => { close(); initialManageOrders(orders); }} className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">
                          Manage all orders.
                        </DropdownItem>
                      )}
                      <DropdownItem onItemClick={() => { close(); initialManageOrders(selected); }} className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">
                        Manage {selected.length} orders.
                      </DropdownItem>
                    </>
                  )}
                  <DropdownSectionHeader label="Cancel" border />
                  {isAllSelected && (
                    <DropdownItem onItemClick={close} className="flex w-full font-normal text-left text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-white/5 dark:hover:text-red-300">
                      Cancel all orders.
                    </DropdownItem>
                  )}
                  <DropdownItem onItemClick={close} className="flex w-full font-normal text-left text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-white/5 dark:hover:text-red-300">
                    Cancel {selected.length} orders.
                  </DropdownItem>
                </>
              )}
            </BulkActionsDropdown>
          )}
        />
      </CardFrame>
      {/* Modal Manage Orders */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        isFullscreen={true}
        className="max-w-[700px] m-4"
      >
        <div className="fixed inset-0 bg-white dark:bg-gray-900">
          <div className="flex h-full flex-col p-6 lg:p-10">
            {/* Header */}
            <div className="shrink-0 px-2 pr-14">
              <h4 className="mb-3 font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Manage Orders
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Update your details to keep your profile up-to-date.
              </p>
            </div>

            {/* Content */}
            {/* prevent entire content panel from scrolling as one unit */}
            <div className="min-h-0 flex-1 overflow-hidden px-2 pt-6">
              {/* flex flex-col + h-full propagates bounded height into the card body */}
              <ComponentTabCard
                tabs={manageOrdersTabs}
                onChange={setActiveManageTab}
                className="md:h-full md:flex md:flex-col md:min-h-0"
                classNameBody="md:flex-1 md:min-h-0 md:overflow-hidden"
              >
                {/* min-h-0 on grid items overrides the default min-height:auto so explicit lg:h-full wins over intrinsic content height */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 lg:gap-8 md:h-full md:min-h-0">
                  <div className="md:col-span-3 min-[1025px]:col-span-2 md:h-full md:min-h-0 md:min-w-0">
                    {/* Unique products By Orders */}
                    <DataTableOne<OrderItemProduct>
                      title="Products"
                      subtitle="Manage and track all customer orders."
                      columns={manageOrdersColumns}
                      data={products}
                      rowKey="id"
                      searchable="header"
                      exportable="header"
                      selectedRowKey={selectedProductId ?? undefined}
                      onRowClick={(row) => setSelectedProductId(prev => prev === row.id ? null : row.id)}
                      onRowLongPress={(row) => setSheetProductId(row.id)}
                      scrollable
                      fillHeight
                    // stickyFirstColumn
                    // defaultPageSize={10}
                    // rowHeight={75}
                    // scrollMaxHeight={350}
                    />
                  </div>
                  {/* flex flex-col h-full so ProductDetailsCard stretches to grid row height */}
                  <div className="hidden min-[1025px]:flex flex-col md:h-full md:min-h-0 md:min-w-0">
                    <ProductDetailsCard product={selectedProduct} />
                  </div>
                </div>
              </ComponentTabCard>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 px-2 pt-6">
              <button
                onClick={closeModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
              >
                Close
              </button>

              <button
                onClick={handleSaveOrders}
                disabled={spinning || Object.keys(unitPrices).length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
              >
                Save Orders
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <BottomSheet
        isOpen={isOpen && sheetProductId !== null}
        onClose={() => setSheetProductId(null)}
        className="min-[1025px]:hidden"
        sheetClassName="!bg-white dark:!bg-gray-900"
        defaultSnap="peek"
        height="70vh"
      >
        <div className="h-full flex flex-col p-4">
          <ProductDetailsCard product={sheetProduct} />
        </div>
      </BottomSheet>
      <OrderDetails
        order={viewOrder}
        isOpen={isDetailsOpen}
        onClose={closeDetails}
      />
      <AlertModal
        isOpen={isAlertOpen}
        onClose={closeAlert}
        variant="warning"
        message="ไม่มี Order ที่สามารถดำเนินการได้ในขณะนี้"
      />
    </>
  );
}
