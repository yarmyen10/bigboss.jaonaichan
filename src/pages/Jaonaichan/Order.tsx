import { useEffect, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { OrdersResponse, Order as OrderIF } from "../../interfaces/order.jaonaichan"
import { apiRequest } from '../../api/client';


type OrderStatus = "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded";

interface WCOrder {
  id: number;
  number: string;
  status: OrderStatus;
  date_created: string;
  billing: { first_name: string; last_name: string; email: string };
  total: string;
  payment_method_title: string;
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-warning/10 text-warning",
  processing: "bg-primary/10 text-primary",
  "on-hold": "bg-meta-6/10 text-meta-6",
  completed: "bg-success/10 text-success",
  cancelled: "bg-danger/10 text-danger",
  refunded: "bg-stroke text-body",
};

const ORDER_COLUMNS: ColumnDef<OrderIF>[] = [
  {
    key: "number",
    label: "Order #",
    sortable: true,
    width: "110px",
    render: (val) => <span className="font-medium text-black dark:text-white">#{val as string}</span>,
  },
  {
    key: "date_created",
    label: "Date",
    sortable: true,
    width: "130px",
    render: (val) => (
      <span className="text-body dark:text-bodydark">
        {new Date(val as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    ),
  },
  {
    key: "billing",
    label: "Customer",
    noExport: true,
    // render: (_, row) => (
    //   <div>
    //     <p className="text-sm font-medium text-black dark:text-white">
    //       {row.billing.first_name} {row.billing.last_name}
    //     </p>
    //     <p className="text-xs text-body dark:text-bodydark">{row.billing.email}</p>
    //   </div>
    // ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (val) => {
      const s = val as OrderStatus;
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[s]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />{s}
        </span>
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
    align: "right",
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
