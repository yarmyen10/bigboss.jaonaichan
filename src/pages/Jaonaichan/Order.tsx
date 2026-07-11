import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from "react-router";
import flatpickr from "flatpickr";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { Order as OrderIF, OrderItemProduct } from "../../interfaces/order.jaonaichan"
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import { getOrder } from "../../services/jaonaichan";
import { STATUS_MANAGE_ACTIONS } from "../../config/manageOrders.jaonaichan";
import { ORDER_STATUS_DETAILS, STATUS_PROGRESS } from "../../config/orderStatus.jaonaichan";
import ListCard from "../../components/jaonaichan/ListCard";
import SmartSearchInput from "../../components/jaonaichan/SmartSearchInput";
import { TabOption } from "../../components/ui/tabs";
import { CalenderIcon, CheckCircleIcon, MoreDotIcon, BoxIcon, PencilIcon, TrashBinIcon } from "../../icons";
import Button from "../../components/ui/button/Button";
import Select from "../../components/form/Select";
import Label from "../../components/form/Label";

import { Modal } from "../../components/ui/modal";
import { AlertModal } from "../../components/ui/modal/AlertModal";
import { useModal } from "../../hooks/useModal";

import Checkbox from "../../components/form/input/Checkbox";
import { useSpinner } from "../../hooks/useSpinner";
import PageSpinner from "../../components/common/PageSpinner";
import ComponentTabCard from "../../components/common/ComponentTabCard";
import ProductDetailsCard from "../../components/jaonaichan/ProductDetailsCard";
import OrderDetails from "../../components/jaonaichan/OrderDetails";
import BottomSheet from "../../components/ui/bottom-sheet/BottomSheet";
import { DateFilter, useOrderList } from "../../hooks/jaonaichan/useOrderList";
import { useManageProducts } from "../../hooks/jaonaichan/useManageProducts";
import { useOrderModals } from "../../hooks/jaonaichan/useOrderModals";
import BillPreviewTable from "../../components/jaonaichan/BillPreviewTable";



type PaymentMethod = "promptpay_qr" | "bank_transfer" | "cod";

const STATUS_ORDER = [
  "waiting-transfer",
  "pending-payment-1", "wait-verify-1", "paid-1",
  "pending-payment-2", "wait-verify-2", "paid-2",
  "packed", "wait-tracking", "tracked", "wait-shipping", "shipped", "completed",
  "processing", "on-hold", "pending", "checkout-draft",
  "cancelled", "refunded", "failed",
];

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
  onViewMore: (row: OrderIF) => void,
  navigate: (to: string) => void,
  onUpdateStatus: (row: OrderIF) => void
): ColumnDef<OrderIF>[] => [
    {
      key: "id",
      label: "Order #",
      sortable: true,
      width: "80px",
      render: (val, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewMore(row);
          }}
          className="text-theme-xs font-medium text-brand-500 hover:text-brand-600 hover:underline dark:text-brand-400 dark:hover:text-brand-300 transition-colors cursor-pointer text-left"
        >
          #{val as string}
        </button>
      ),
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
      // width: "180px",
      render: (val, row) => {
        const s = val as string;
        return (
          <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            <Badge variant="gradient" color={((ORDER_STATUS_DETAILS[s]?.color ?? 'light') as BadgeColor)}>
              {ORDER_STATUS_DETAILS[s]?.text ?? s}
            </Badge>
            {row.bill2?.unit_prices_id && ["pending-payment-2", "wait-verify-2"].includes(row.status) && (
              <Badge variant="light" size="sm" color={row.bill2.status === "draft" ? "warning" : "success"}>
                {row.bill2.status === "draft" ? "Draft" : "Published"}
              </Badge>
            )}
            {row.is_rts && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                ⚡ RTS
              </span>
            )}
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
      render: (val, row) => {
        let displayTotal = Number(val);
        const s = row.status;
        if (["pending-payment-1", "wait-verify-1", "paid-1", "waiting-transfer"].includes(s)) {
          displayTotal = Number(row.bill1?.amount || 0);
        } else if (["pending-payment-2", "wait-verify-2", "paid-2"].includes(s)) {
          displayTotal = Number(row.bill2?.amount || 0);
        }

        return (
          <span className="font-semibold text-black dark:text-white">
            ฿{displayTotal.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "progress",
      label: "Progress",
      width: "130px",
      noExport: true,
      sortable: true,
      sortValue: (row) => STATUS_ORDER.indexOf(row.status),
      render: (_val, row) => {
        const pct = STATUS_PROGRESS[row.status] ?? 0;
        const barColor = pct === 0 ? "bg-gray-300 dark:bg-gray-600"
          : pct <= 40 ? "bg-amber-400 dark:bg-amber-500"
          : pct <= 65 ? "bg-blue-500 dark:bg-blue-400"
          : pct < 100 ? "bg-teal-500 dark:bg-teal-400"
          : "bg-emerald-500 dark:bg-emerald-400";
        return (
          <div className="flex flex-col gap-1.5 min-w-[100px]">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {(row.bill1?.status === "paid" ? 1 : 0) + (!row.is_rts && row.bill2?.status === "paid" ? 1 : 0)}/{row.is_rts ? 1 : 2}
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
                    onItemClick={() => { setOpenDropdownId(null); navigate(`/jaonaichan/invoice/${row.id}`); }}
                    className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    Invoice
                  </DropdownItem>
                  <DropdownItem
                    onItemClick={() => { setOpenDropdownId(null); onUpdateStatus(row); }}
                    className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    Update Status
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


const renderFeeInput = (
  value: string,
  setValue: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  rowId: number,
  setSelectedProductId: React.Dispatch<React.SetStateAction<number | null>>
) => (
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
      onFocus={() => setSelectedProductId(rowId)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const next = parts.length > 1
          ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
          : raw;
        setValue((prev) => {
          if (next === "") {
            const { [rowId]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [rowId]: next };
        });
      }}
      className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
    />
  </div>
);

const getManageOrderColumns = (
  unitPrices: Record<number, string>,
  setUnitPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  chinaShippingPrices: Record<number, string>,
  setChinaShippingPrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  importFeePrices: Record<number, string>,
  setImportFeePrices: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  setSelectedProductId: React.Dispatch<React.SetStateAction<number | null>>
): ColumnDef<OrderItemProduct>[] => [
    {
      key: "name",
      label: "Product",
      sortable: true,
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
      render: (_val, row) => renderFeeInput(unitPrices[row.id] ?? "", setUnitPrices, row.id, setSelectedProductId),
    },
    {
      key: "china_shipping",
      label: "China Shipping (Total)",
      width: "150px",
      noExport: true,
      render: (_val, row) => renderFeeInput(chinaShippingPrices[row.id] ?? "", setChinaShippingPrices, row.id, setSelectedProductId),
    },
    {
      key: "import_fee",
      label: "Import Fee (Total)",
      width: "150px",
      noExport: true,
      render: (_val, row) => renderFeeInput(importFeePrices[row.id] ?? "", setImportFeePrices, row.id, setSelectedProductId),
    },
  ];


export default function Order() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { spinning, withSpinner } = useSpinner(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const {
    displayOrders,
    isLoading,
    dateFilter,
    handleFilterChange,
    statusTab,
    handleTabChange,
    searchType,
    setSearchType,
    searchValue,
    setSearchValue,
    selectedStatuses,
    setSelectedStatuses,
    rtsFilter,
    setRtsFilter,
    loadOrders
  } = useOrderList();

  const CARD_PAGE_SIZE = 10;
  const [cardPage, setCardPage] = useState(1);
  useEffect(() => { setCardPage(1); }, [displayOrders]);
  const cardTotalPages = Math.max(1, Math.ceil(displayOrders.length / CARD_PAGE_SIZE));
  const pagedOrders = displayOrders.slice((cardPage - 1) * CARD_PAGE_SIZE, cardPage * CARD_PAGE_SIZE);

  const handleSaved = useCallback(() => {
    loadOrders(dateFilter);
  }, [loadOrders, dateFilter]);

  const {
    viewOrder,
    setViewOrder,
    isDetailsOpen,
    openDetails,
    closeDetails,
    handleViewMore,
    isUpdateStatusOpen,
    closeUpdateStatus,
    updateStatusOrders,
    newStatus,
    setNewStatus,
    removeSlip,
    setRemoveSlip,
    handleOpenUpdateStatus,
    handleConfirmUpdateStatus,
    isDeleteOpen,
    closeDelete,
    deleteTargetOrders,
    handleOpenDelete,
    handleConfirmDelete,
  } = useOrderModals({ withSpinner, onSaved: handleSaved });

  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: isAlertOpen, openModal: openAlert, closeModal: closeAlert } = useModal();
  const [editingProduct, setEditingProduct] = useState<OrderItemProduct | null>(null);

  const {
    products,
    selectedProductId,
    setSelectedProductId,
    selectedProduct,
    sheetProductId,
    setSheetProductId,
    sheetProduct,
    unitPrices,
    setUnitPrices,
    chinaShippingPrices,
    setChinaShippingPrices,
    importFeePrices,
    setImportFeePrices,
    localShippingPrice,
    setLocalShippingPrice,
    manageOrdersTabs,
    activeManageTab,
    setActiveManageTab,
    initialManageOrders,
    handleSaveOrders,
    isPreviewOpen,
    closePreviewModal,
    previewOrders,
    extraFees,
    setExtraFees,
    handleConfirmSaveOrders,
  } = useManageProducts({ withSpinner, openModal, closeModal, openAlert, onSaved: handleSaved });

  useEffect(() => {
    const idParam = searchParams.get("orderId");
    if (!idParam) return;
    const id = Number(idParam);
    if (!id) return;
    setSearchParams(prev => { prev.delete("orderId"); return prev; }, { replace: true });
    getOrder(id).then((order: OrderIF) => {
      setViewOrder(order);
      openDetails();
    }).catch(() => {/* silent */});
  }, [searchParams, setSearchParams, openDetails, setViewOrder]);

  const columns = useMemo(
    () => getOrderColumns(buttonRefs, openDropdownId, setOpenDropdownId, handleViewMore, navigate, (row) => handleOpenUpdateStatus([row])),
    [openDropdownId, handleViewMore, navigate, handleOpenUpdateStatus]
  );

  const manageOrdersColumns = useMemo(
    () => getManageOrderColumns(
      unitPrices, setUnitPrices,
      chinaShippingPrices, setChinaShippingPrices,
      importFeePrices, setImportFeePrices,
      setSelectedProductId
    ),
    [
      unitPrices, setUnitPrices,
      chinaShippingPrices, setChinaShippingPrices,
      importFeePrices, setImportFeePrices,
      setSelectedProductId
    ]
  );

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

      {/* Desktop table */}
      <div className="hidden min-[1025px]:block">
      <CardFrame isLoading={isLoading}>
        <DataTableOne<OrderIF>
          title="Orders"
          subtitle="Manage and track all customer orders."
          columns={columns}
          data={displayOrders}
          rowKey="id"
          selectable
          searchable="header"
          exportable="header"
          customHeaderSearch={
            <SmartSearchInput
              searchType={searchType}
              setSearchType={setSearchType}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              selectedStatuses={selectedStatuses}
              setSelectedStatuses={setSelectedStatuses}
              statusOptions={Object.entries(ORDER_STATUS_DETAILS).map(([k, v]) => ({ value: k, label: v.text }))}
              rtsFilter={rtsFilter}
              setRtsFilter={setRtsFilter}
            />
          }
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
          bulkActions={(selected, isAllSelected) => {
            const targetOrders = isAllSelected ? displayOrders : selected;
            
            const manageableOrders = targetOrders.filter(o => 
              (STATUS_MANAGE_ACTIONS[o.status]?.length ?? 0) > 0 && !o.bill2?.unit_prices_id
            );
            const canManage = manageableOrders.length > 0;
            
            return (
              <div className="flex items-center gap-2">
                {canManage && (
                  <div className="group relative">
                    <button
                      onClick={() => initialManageOrders(manageableOrders)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors shadow-sm"
                    >
                      <BoxIcon className="size-5" />
                    </button>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none dark:bg-gray-700 hidden sm:block">
                      Manage {manageableOrders.length} Orders
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                )}
                
                <div className="group relative">
                  <button
                    onClick={() => handleOpenUpdateStatus(targetOrders)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors shadow-sm"
                  >
                    <PencilIcon className="size-5" />
                  </button>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none dark:bg-gray-700 hidden sm:block">
                    Update {isAllSelected ? "All" : selected.length} Orders
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                  </div>
                </div>

                <div className="group relative">
                  <button
                    onClick={() => handleOpenDelete(targetOrders)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors shadow-sm"
                  >
                    <TrashBinIcon className="size-5" />
                  </button>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none dark:bg-red-500 hidden sm:block">
                    Cancel {isAllSelected ? "All" : selected.length} Orders
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600 dark:border-t-red-500"></div>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </CardFrame>
      </div>

      {/* Mobile/tablet card list */}
      <div className="min-[1025px]:hidden">
        {/* Tabs */}
        <div className="flex gap-1 mb-3 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          {(["all", "unpaid", "paid"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                statusTab === tab
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab === "all" ? "All Order" : tab === "unpaid" ? "Unpaid" : "Paid"}
            </button>
          ))}
        </div>
        {/* Search + date filter */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <SmartSearchInput
              searchType={searchType}
              setSearchType={setSearchType}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              selectedStatuses={selectedStatuses}
              setSelectedStatuses={setSelectedStatuses}
              statusOptions={Object.entries(ORDER_STATUS_DETAILS).map(([k, v]) => ({ value: k, label: v.text }))}
              rtsFilter={rtsFilter}
              setRtsFilter={setRtsFilter}
            />
          </div>
          <DateFilterDropdown value={dateFilter} onChange={handleFilterChange} />
        </div>
        {/* Cards */}
        {isLoading ? (
          <div className="flex justify-center py-12 text-sm text-gray-400">Loading…</div>
        ) : displayOrders.length === 0 ? (
          <div className="flex justify-center py-12 text-sm text-gray-400">No orders found</div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {pagedOrders.map((order) => (
                <ListCard
                  key={order.id}
                  order={order}
                  onView={handleViewMore}
                  onInvoice={(id) => navigate(`/jaonaichan/invoice/${id}`)}
                  onUpdateStatus={(o) => handleOpenUpdateStatus([o])}
                />
              ))}
            </div>
            {cardTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-xs text-gray-400">
                  {(cardPage - 1) * CARD_PAGE_SIZE + 1}–{Math.min(cardPage * CARD_PAGE_SIZE, displayOrders.length)} of {displayOrders.length}
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

      {/* Modal Manage Orders */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        isFullscreen={true}
      >
          <div className="flex h-full w-full flex-col bg-white p-6 dark:bg-gray-900 lg:p-10">
            {/* Header */}
            <div className="shrink-0 px-2 pr-14">
              <h4 className="mb-3 font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Manage Orders
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ตั้งราคาและค่าจัดส่งบิล 2 สำหรับออเดอร์ที่เลือก
              </p>
            </div>

            {/* Content */}
            {/* prevent entire content panel from scrolling as one unit */}
            <div className="min-h-0 flex-1 overflow-hidden px-2 pt-6">
              {/* flex flex-col + h-full propagates bounded height into the card body */}
              <ComponentTabCard
                tabs={manageOrdersTabs}
                onChange={setActiveManageTab}
                className="h-full flex flex-col min-h-0"
                classNameBody="flex-1 min-h-0 overflow-y-auto min-[1025px]:overflow-hidden"
              >
                {/* ≥1025px: same input lives in the desktop table's toolbar (toolbarExtra below) */}
                {activeManageTab === "bill2" && (
                  <div className="shrink-0 flex items-center gap-3 min-[1025px]:hidden">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Local Shipping (per order)
                    </label>
                    <div className="relative w-32">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        ฿
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={localShippingPrice}
                        onChange={(e) => setLocalShippingPrice(e.target.value.replace(/[^\d.]/g, ""))}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                      />
                    </div>
                  </div>
                )}

                {/* below 1025px the Card Body itself scrolls (see classNameBody above), so
                    nothing in here needs its own height/overflow — it just grows naturally.
                    At ≥1025px the desktop table takes over with its own internal scroll,
                    which is why flex-1/min-h-0 only kick in at that breakpoint. */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 lg:gap-8 min-[1025px]:flex-1 min-[1025px]:min-h-0">
                  <div className="md:col-span-3 min-[1025px]:col-span-2 flex flex-col min-[1025px]:h-full min-[1025px]:min-h-0 min-w-0 pb-4 min-[1025px]:pb-0">
                    {/* Unique products By Orders */}
                    <div className="flex-1 min-h-0 hidden min-[1025px]:block">
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
                        toolbarLeftExtra={activeManageTab === "bill2" && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Local Shipping (per order)
                            </label>
                            <div className="relative w-32">
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                                ฿
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={localShippingPrice}
                                onChange={(e) => setLocalShippingPrice(e.target.value.replace(/[^\d.]/g, ""))}
                                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                              />
                            </div>
                          </div>
                        )}
                      // rowHeight={75}
                      // scrollMaxHeight={350}
                      />
                    </div>

                    {/* Mobile Product Card List — visible only on ≤1024px.
                        No overflow/height here — Card Body (classNameBody above) is the scroll container. */}
                    <div className="min-[1025px]:hidden flex flex-col gap-3 pr-1">
                      {products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <BoxIcon className="mb-2 size-10 text-gray-300 dark:text-gray-600" />
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No products found</p>
                        </div>
                      ) : (
                        products.map((product) => {
                          const hasUnit = !!unitPrices[product.id];
                          const hasChina = !!chinaShippingPrices[product.id];
                          const hasImport = !!importFeePrices[product.id];
                          const hasPrices = hasUnit || hasChina || hasImport;

                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => setEditingProduct(product)}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                                hasPrices
                                  ? "border-brand-200 bg-brand-50/50 dark:border-brand-800/40 dark:bg-brand-900/10"
                                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.02] dark:hover:border-gray-600"
                              }`}
                            >
                              <img
                                src={product.image?.thumbnail ?? product.image?.medium ?? ""}
                                alt={product.name}
                                className="h-12 w-12 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {product.name}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{product.sku}</p>
                                {hasPrices && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {hasUnit && (
                                      <span className="inline-flex items-center rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                                        ฿{unitPrices[product.id]}
                                      </span>
                                    )}
                                    {hasChina && (
                                      <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                        Ship ฿{chinaShippingPrices[product.id]}
                                      </span>
                                    )}
                                    {hasImport && (
                                      <span className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                                        Import ฿{importFeePrices[product.id]}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <svg className="size-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          );
                        })
                      )}
                    </div>

                    
                    {activeManageTab === "bill2" && (
                      <div className="mt-3 shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-800 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-300">
                        <p className="font-semibold mb-1">สูตรคำนวณยอดบิล 2 (ต่อออเดอร์):</p>
                        <p className="font-mono text-xs opacity-90 mb-1.5">
                          ยอดรวม = Σ(ราคาต่อหน่วย × จำนวน) + Σ(ค่าส่งจีนเฉลี่ยต่อชิ้น × จำนวน) + Σ(ค่านำเข้าเฉลี่ยต่อชิ้น × จำนวน) + ค่าจัดส่งพัสดุ
                        </p>
                        <ul className="list-disc pl-5 text-xs opacity-80 space-y-0.5">
                          <li>ค่าส่งจีนและค่านำเข้าเฉลี่ยต่อชิ้น = ยอดรวมของสินค้าที่กรอก ÷ จำนวนชิ้นทั้งหมดในรอบนี้</li>
                          <li>ค่าจัดส่งพัสดุ = ยอดตามที่ระบุด้านบนสุด (คิดต่อ 1 ออเดอร์)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* flex flex-col h-full so ProductDetailsCard stretches to grid row height */}
                  <div className="hidden min-[1025px]:flex flex-col min-[1025px]:h-full min-[1025px]:min-h-0 min-w-0">
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
      </Modal>

      {/* Modal: Save Orders Preview */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={closePreviewModal}
        className="max-w-4xl m-4 p-6"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="shrink-0 mb-5 pr-8">
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              ผลลัพธ์ — Bill 2 แต่ละ Order
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ตรวจสอบยอดก่อนบันทึก เพิ่มค่าใช้จ่ายอื่นๆ ต่อ order ได้ในช่อง "เพิ่มเติม"
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto -mx-6 px-6">
            <BillPreviewTable orders={previewOrders} extraFees={extraFees} setExtraFees={setExtraFees} />
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 pt-5">
            <button
              onClick={closePreviewModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
            >
              ย้อนกลับ
            </button>
            <button
              onClick={handleConfirmSaveOrders}
              disabled={spinning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
            >
              ยืนยันและบันทึก
            </button>
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

      {/* Mobile Edit Product Modal — for editing prices on small screens */}
      <Modal
        isOpen={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
        className="max-w-[400px] p-5 sm:p-6"
      >
        {editingProduct && (
          <div>
            {/* Product Info */}
            <div className="flex items-center gap-3 mb-5">
              <img
                src={editingProduct.image?.thumbnail ?? editingProduct.image?.medium ?? ""}
                alt={editingProduct.name}
                className="h-14 w-14 shrink-0 rounded-xl object-cover bg-gray-100 dark:bg-gray-800"
              />
              <div className="min-w-0 pr-8">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {editingProduct.name}
                </h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">{editingProduct.sku}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Price: ฿{Number(editingProduct.price).toLocaleString()}
                  {editingProduct.stock !== null && ` · Stock: ${editingProduct.stock}`}
                </p>
              </div>
            </div>

            {/* Input Fields */}
            <div className="space-y-4">
              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Unit Price
                </label>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    ฿
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={unitPrices[editingProduct.id] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d.]/g, "");
                      const parts = raw.split(".");
                      const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : raw;
                      setUnitPrices((prev) => {
                        if (next === "") { const { [editingProduct.id]: _, ...rest } = prev; return rest; }
                        return { ...prev, [editingProduct.id]: next };
                      });
                    }}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  />
                </div>
              </div>

              {/* China Shipping */}
              {activeManageTab === "bill2" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    China Shipping (Total)
                  </label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      ฿
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={chinaShippingPrices[editingProduct.id] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.]/g, "");
                        const parts = raw.split(".");
                        const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : raw;
                        setChinaShippingPrices((prev) => {
                          if (next === "") { const { [editingProduct.id]: _, ...rest } = prev; return rest; }
                          return { ...prev, [editingProduct.id]: next };
                        });
                      }}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>
              )}

              {/* Import Fee */}
              {activeManageTab === "bill2" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Import Fee (Total)
                  </label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      ฿
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={importFeePrices[editingProduct.id] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.]/g, "");
                        const parts = raw.split(".");
                        const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : raw;
                        setImportFeePrices((prev) => {
                          if (next === "") { const { [editingProduct.id]: _, ...rest } = prev; return rest; }
                          return { ...prev, [editingProduct.id]: next };
                        });
                      }}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Done Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setEditingProduct(null)}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
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
      {/* Modal Update Status */}
      <Modal
        isOpen={isUpdateStatusOpen}
        onClose={closeUpdateStatus}
        className="max-w-[420px] p-6 lg:p-8"
      >
        <div>
          <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
            Update Order Status
          </h4>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Updating {updateStatusOrders.length} order{updateStatusOrders.length !== 1 ? "s" : ""}
          </p>
          <div className="mb-5">
            <Label>New Status</Label>
            <Select
              key={isUpdateStatusOpen ? "open" : "closed"}
              options={Object.entries(ORDER_STATUS_DETAILS)
                .filter(([key]) =>
                  updateStatusOrders.every(o => o.is_rts)
                    ? !["pending-payment-2", "wait-verify-2", "paid-2"].includes(key)
                    : true
                )
                .map(([key, detail]) => ({ value: key, label: detail.text }))}
              placeholder="Select new status"
              defaultValue={newStatus}
              onChange={setNewStatus}
            />
          </div>
          <div>
            <Checkbox
              label="Remove payment slip"
              checked={removeSlip}
              onChange={setRemoveSlip}
            />
            <p className="mt-1.5 ml-8 text-xs text-gray-400 dark:text-gray-500">
              Removes the uploaded payment slip from each order
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={closeUpdateStatus}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpdateStatus}
              disabled={!newStatus || spinning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Delete Orders */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDelete}
        className="max-w-[400px] p-6 lg:p-8"
      >
        <div>
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            Cancel Orders
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to permanently delete {deleteTargetOrders.length} order{deleteTargetOrders.length !== 1 ? "s" : ""}? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={closeDelete}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
            >
              Close
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={spinning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm text-white shadow-theme-xs transition hover:bg-red-600 disabled:opacity-50"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
