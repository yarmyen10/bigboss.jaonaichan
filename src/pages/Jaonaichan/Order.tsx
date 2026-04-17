import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { OrdersResponse, Order as OrderIF } from "../../interfaces/order.jaonaichan"
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import { getOrders, getProductsBulk } from "../../services/jaonaichan";
import { TabDefault, TabOption } from "../../components/ui/tabs";
import { MoreDotIcon } from "../../icons";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { useSpinner } from "../../hooks/useSpinner";
import PageSpinner from "../../components/common/PageSpinner";



type OrderStatus = "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed" | "checkout-draft" | "waiting-transfer";
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

const STATUS_DETAILS_AND_STYLE: Record<OrderStatus, Details> = {
  "pending": { color: "primary", text: "Pending payment" },
  "processing": { color: "warning", text: "Processing" },
  "on-hold": { color: "dark", text: "On hold" },
  "completed": { color: "success", text: "Completed" },
  "cancelled": { color: "light", text: "Cancelled" },
  "refunded": { color: "light", text: "Refunded" },
  "failed": { color: "error", text: "Failed" },
  "checkout-draft": { color: "light", text: "Draft" },
  "waiting-transfer": { color: "warning", text: "Waiting Transfer" },
};

const PAYMENT_METHOD_DETAILS: Record<PaymentMethod, Details> = {
  "promptpay_qr": {
    color: "primary",
    text: "PromptPay QR",
    icon: <img src="/images/order/prompt-pay-logo.jpg" className="object-cover" />
  },
  "bank_transfer": { color: "info", text: "Bank Transfer" },
  "cod": { color: "light", text: "Cash on Delivery" },
};

const getOrderColumns = (
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>,
  openDropdownId: string | null,
  setOpenDropdownId: (id: string | null) => void
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
      // width: "150px",
      render: (val) => {
        const s = val as OrderStatus;
        return (
          <Badge variant="light" color={((STATUS_DETAILS_AND_STYLE[s]?.color ?? 'light') as BadgeColor)}>
            {STATUS_DETAILS_AND_STYLE[s]?.text ?? s}
          </Badge>
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
                    onItemClick={() => setOpenDropdownId(null)}
                    className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    View More
                  </DropdownItem>
                  <DropdownItem
                    onItemClick={() => setOpenDropdownId(null)}
                    className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
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

export default function Order() {
  const { spinning, withSpinner } = useSpinner(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [orders, setOrders] = useState<OrderIF[]>([]);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const columns = useMemo(
    () => getOrderColumns(buttonRefs, openDropdownId, setOpenDropdownId),
    [openDropdownId]
  );

  const init = async () => {
    try {
      setIsLoading(true);
      console.log("load data...");
      const res: OrdersResponse = await getOrders();
      if (res?.data?.length) {
        setOrders(res.data)
      }
      console.log('res=', res);

    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    init();
  }, []);

  const { isOpen, openModal, closeModal } = useModal();
  const handleSave = () => {
    // Handle save logic here
    console.log("Saving changes...");
    closeModal();
  };

  const initialManageOrders = () => {
    withSpinner(async () => {
      await getProductsBulk();
    });
    openModal();
  }

  if (spinning) {
    return <PageSpinner />;
  }

  return (
    <>
      <PageMeta
        title="React.js Order Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Order Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Order Jaonaichan" />
      <CardFrame isLoading={isLoading}>
        <DataTableOne<OrderIF>
          title="Orders"
          subtitle="Manage and track all customer orders."
          columns={columns}
          data={orders}
          rowKey="id"
          searchable="header"
          exportable="header"
          tabs={[
            { value: "all", label: "All Order" },
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
          ] as TabOption[]}
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
          bulkActions={(selected) => (
            <>
              <Button
                className="!px-3 !py-1 text-sm"
                variant="orange"
                onClick={initialManageOrders}
              >
                Manage {selected.length} orders
              </Button>

              <Button
                className="!px-3 !py-1 text-sm"
                variant="outline"
              >
                Cancel {selected.length} orders
              </Button>
            </>
          )}
        />
      </CardFrame>
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
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-6">
              <div className="relative max-w-3xs flex-1">
                <TabDefault />
              </div>
              {/* <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
                euismod est quis mauris lacinia pharetra. Sed a ligula ac odio
                condimentum aliquet a nec nulla. Aliquam bibendum ex sit amet ipsum
                rutrum feugiat ultrices enim quam.
              </p>

              <p className="mt-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
                euismod est quis mauris lacinia pharetra. Sed a ligula ac odio
                condimentum aliquet a nec nulla. Aliquam bibendum ex sit amet ipsum
                rutrum feugiat ultrices enim quam odio condimentum aliquet a nec nulla
                pellentesque euismod est quis mauris lacinia pharetra.
              </p>

              <p className="mt-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
                euismod est quis mauris lacinia pharetra.
              </p> */}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 px-2 pt-6">
              <button
                onClick={closeModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300"
              >
                Close
              </button>

              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
  // ดึง Orders
  // async function getOrders(page = 1, per_page = 10): Promise<OrdersResponse> {
  //   return apiRequest(`/jaonaichan/v1/orders?page=${page}&per_page=${per_page}`);
  // }
}
