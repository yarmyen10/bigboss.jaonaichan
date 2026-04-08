import { useEffect, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { OrdersResponse, Order as OrderIF } from "../../interfaces/order.jaonaichan"
import { apiRequest } from '../../api/client';
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";


type OrderStatus = "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed" | "checkout-draft" | "waiting-transfer";

// interface WCOrder {
//   id: number;
//   number: string;
//   status: OrderStatus;
//   date_created: string;
//   billing: { first_name: string; last_name: string; email: string };
//   total: string;
//   payment_method_title: string;
// }

interface OrderStatusDetails {
  color: BadgeColor;
  text: string;
}

const STATUS_DETAILS_AND_STYLE: Record<OrderStatus, OrderStatusDetails> = {
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

const ORDER_COLUMNS: ColumnDef<OrderIF>[] = [
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
        <Badge variant="light" color={(STATUS_DETAILS_AND_STYLE[s].color as BadgeColor)}>
          { STATUS_DETAILS_AND_STYLE[s].text }
        </Badge>
      );
    },
  },
  {
    key: "payment_method_title",
    label: "Payment",
    render: (val) => <span className="text-body dark:text-bodydark">{val as string}</span>,
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
]

export default function Order() {
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [orders, setOrders] = useState<OrderIF[]>([]);

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

  return (
    <div>
      <PageMeta
        title="React.js Order Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Order Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Order Jaonaichan" />
      <CardFrame isLoading={isLoading}>
        <DataTableOne<OrderIF> 
          title="Orders"
          subtitle="Manage and track all customer orders."
          columns={ORDER_COLUMNS}
          data={orders}
          rowKey="id"
        />
      </CardFrame>
    </div>
  );

  // ดึง Orders
  async function getOrders(page = 1, per_page = 10): Promise<OrdersResponse> {
    return apiRequest(`/jaonaichan/v1/orders?page=${page}&per_page=${per_page}`);
  }
}
