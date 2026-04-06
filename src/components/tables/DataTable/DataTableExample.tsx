/**
 * DataTableExample.tsx
 * ตัวอย่างการใช้ DataTable กับ 3 หน้า
 *  1. Products  — async + filter stock + thumbnail
 *  2. Orders    — async + filter status + status badge
 *  3. Customers — static data + bulk delete
 */

import DataTable, { ColumnDef, FetchParams, FetchResult, RowAction } from "./DataTable";

// ─── shared icons ─────────────────────────────────────────────────────────────

const IcoEdit = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IcoTrash = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const IcoEye = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IcoPlus = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IcoDownload = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRODUCTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

interface WCProduct {
  id: number;
  name: string;
  sku: string;
  images: { src: string; alt: string }[];
  categories: { name: string }[];
  attributes?: { name: string; options: string[] }[];
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: "instock" | "outofstock" | "onbackorder";
  date_created: string;
}

const PRODUCT_COLUMNS: ColumnDef<WCProduct>[] = [
  {
    key: "name",
    label: "Products",
    sortable: true,
    render: (_, row) => (
      <div className="flex items-center gap-4">
        {row.images?.[0] ? (
          <img src={row.images[0].src} alt={row.name}
            className="h-[46px] w-[46px] rounded-md border border-stroke object-cover dark:border-strokedark" />
        ) : (
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-md border border-stroke bg-gray-1 dark:border-strokedark dark:bg-meta-4">
            <span className="text-xs text-body">N/A</span>
          </div>
        )}
        <div>
          <p className="max-w-[200px] truncate text-sm font-medium text-black dark:text-white">{row.name}</p>
          {row.sku && <p className="text-xs text-body dark:text-bodydark">SKU: {row.sku}</p>}
        </div>
      </div>
    ),
  },
  {
    key: "categories",
    label: "Category",
    render: (_, row) => <span className="text-body dark:text-bodydark">{row.categories?.[0]?.name ?? "—"}</span>,
  },
  {
    key: "attributes",
    label: "Brand",
    noExport: true,
    render: (_, row) => {
      const brand = row.attributes?.find((a) => a.name.toLowerCase() === "brand")?.options?.[0];
      return <span className="text-body dark:text-bodydark">{brand ?? "—"}</span>;
    },
  },
  {
    key: "price",
    label: "Price",
    sortable: true,
    align: "right",
    render: (_, row) => (
      <div className="text-right">
        <span className="font-medium text-black dark:text-white">
          ฿{Number(row.sale_price || row.price).toLocaleString()}
        </span>
        {row.sale_price && (
          <span className="ml-1 text-xs text-body line-through">
            ฿{Number(row.regular_price).toLocaleString()}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "stock_status",
    label: "Stock",
    render: (val) => {
      if (val === "instock")     return <span className="font-medium text-meta-3">In Stock</span>;
      if (val === "onbackorder") return <span className="font-medium text-warning">Backorder</span>;
      return <span className="font-medium text-danger">Out of Stock</span>;
    },
  },
  {
    key: "date_created",
    label: "Created At",
    sortable: true,
    render: (val) => (
      <span className="text-body dark:text-bodydark">
        {new Date(val as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    ),
  },
];

async function fetchProducts(params: FetchParams): Promise<FetchResult<WCProduct>> {
  const qs = new URLSearchParams({
    page:     String(params.page),
    per_page: String(params.pageSize),
    ...(params.search && { search: params.search }),
    ...(params.filters.stock_status && { stock_status: params.filters.stock_status }),
    orderby:  params.sortKey === "price" ? "price" : params.sortKey === "name" ? "title" : "date",
    order:    params.sortDir,
  });
  const res = await fetch(`/wp-json/wc/v3/products?${qs}`, {
    headers: { Authorization: "Basic " + btoa("ck_xxx:cs_xxx") },
  });
  return { data: await res.json(), total: Number(res.headers.get("X-WP-Total") ?? 0) };
}

export function ProductsPage() {
  return (
    <DataTable<WCProduct>
      title="Products List"
      subtitle="Track your store's progress to boost your sales."
      columns={PRODUCT_COLUMNS}
      fetchFn={fetchProducts}
      rowKey="id"
      defaultPageSize={7}
      exportFilename="products.csv"
      filters={[{
        label: "Stock Status",
        paramKey: "stock_status",
        options: [
          { label: "All",          value: "" },
          { label: "In Stock",     value: "instock" },
          { label: "Out of Stock", value: "outofstock" },
          { label: "Backorder",    value: "onbackorder" },
        ],
      }]}
      rowActions={[
        { label: "View",   icon: <IcoEye />,   onClick: (p) => console.log("view", p.id) },
        { label: "Edit",   icon: <IcoEdit />,  onClick: (p) => console.log("edit", p.id) },
        { label: "Delete", icon: <IcoTrash />, variant: "danger", onClick: (p) => console.log("delete", p.id) },
      ]}
      headerActions={
        <>
          <button className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-gray-1 dark:border-strokedark dark:bg-boxdark dark:text-white">
            Export <IcoDownload />
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-opacity-90">
            <IcoPlus /> Add Product
          </button>
        </>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ORDERS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

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
  pending:    "bg-warning/10 text-warning",
  processing: "bg-primary/10 text-primary",
  "on-hold":  "bg-meta-6/10 text-meta-6",
  completed:  "bg-success/10 text-success",
  cancelled:  "bg-danger/10 text-danger",
  refunded:   "bg-stroke text-body",
};

const ORDER_COLUMNS: ColumnDef<WCOrder>[] = [
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
    render: (_, row) => (
      <div>
        <p className="text-sm font-medium text-black dark:text-white">
          {row.billing.first_name} {row.billing.last_name}
        </p>
        <p className="text-xs text-body dark:text-bodydark">{row.billing.email}</p>
      </div>
    ),
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
];

async function fetchOrders(params: FetchParams): Promise<FetchResult<WCOrder>> {
  const qs = new URLSearchParams({
    page:     String(params.page),
    per_page: String(params.pageSize),
    ...(params.search && { search: params.search }),
    ...(params.filters.status && { status: params.filters.status }),
    orderby:  params.sortKey === "number" ? "id" : params.sortKey === "total" ? "total" : "date",
    order:    params.sortDir,
  });
  const res = await fetch(`/wp-json/wc/v3/orders?${qs}`, {
    headers: { Authorization: "Basic " + btoa("ck_xxx:cs_xxx") },
  });
  return { data: await res.json(), total: Number(res.headers.get("X-WP-Total") ?? 0) };
}

export function OrdersPage() {
  return (
    <DataTable<WCOrder>
      title="Orders"
      subtitle="Manage and track all customer orders."
      columns={ORDER_COLUMNS}
      fetchFn={fetchOrders}
      rowKey="id"
      exportFilename="orders.csv"
      filters={[{
        label: "Status",
        paramKey: "status",
        options: [
          { label: "All",        value: "" },
          { label: "Pending",    value: "pending" },
          { label: "Processing", value: "processing" },
          { label: "On Hold",    value: "on-hold" },
          { label: "Completed",  value: "completed" },
          { label: "Cancelled",  value: "cancelled" },
        ],
      }]}
      rowActions={[
        { label: "View",        icon: <IcoEye />,   onClick: (o) => console.log("view", o.id) },
        { label: "Edit Status", icon: <IcoEdit />,  onClick: (o) => console.log("edit", o.id) },
        { label: "Delete",      icon: <IcoTrash />, variant: "danger", onClick: (o) => console.log("delete", o.id) },
      ]}
      bulkActions={(selected) => (
        <button className="rounded border border-danger bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10">
          Cancel {selected.length} orders
        </button>
      )}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CUSTOMERS PAGE  (static data ตัวอย่าง)
// ═══════════════════════════════════════════════════════════════════════════════

interface Customer {
  id: number;
  avatar_url: string;
  first_name: string;
  last_name: string;
  email: string;
  orders_count: number;
  total_spent: string;
  date_created: string;
}

const CUSTOMER_COLUMNS: ColumnDef<Customer>[] = [
  {
    key: "first_name",
    label: "Customer",
    sortable: true,
    render: (_, row) => (
      <div className="flex items-center gap-3">
        <img
          src={row.avatar_url || `https://ui-avatars.com/api/?name=${row.first_name}+${row.last_name}&background=3c50e0&color=fff`}
          alt={row.first_name}
          className="h-9 w-9 rounded-full object-cover"
        />
        <div>
          <p className="text-sm font-medium text-black dark:text-white">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-body dark:text-bodydark">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: "orders_count",
    label: "Orders",
    sortable: true,
    align: "center",
    render: (val) => <span className="font-medium text-black dark:text-white">{val as number}</span>,
  },
  {
    key: "total_spent",
    label: "Total Spent",
    sortable: true,
    align: "right",
    render: (val) => (
      <span className="font-semibold text-black dark:text-white">
        ฿{Number(val).toLocaleString()}
      </span>
    ),
  },
  {
    key: "date_created",
    label: "Member Since",
    sortable: true,
    render: (val) => (
      <span className="text-body dark:text-bodydark">
        {new Date(val as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    ),
  },
];

const MOCK_CUSTOMERS: Customer[] = Array.from({ length: 35 }, (_, i) => ({
  id: i + 1,
  avatar_url: "",
  first_name: ["สมชาย", "วิภา", "อาร์ม", "น้ำฝน", "กิตติ"][i % 5],
  last_name:  ["ใจดี", "รักสกุล", "วิทยา", "สุขสม", "มีชัย"][i % 5],
  email: `user${i + 1}@example.com`,
  orders_count: Math.floor(Math.random() * 30) + 1,
  total_spent:  String(Math.round(Math.random() * 50000 + 500)),
  date_created: new Date(Date.now() - i * 7 * 86400000).toISOString(),
}));

export function CustomersPage() {
  return (
    <DataTable<Customer>
      title="Customers"
      subtitle="All registered customers in your store."
      columns={CUSTOMER_COLUMNS}
      data={MOCK_CUSTOMERS}
      rowKey="id"
      exportFilename="customers.csv"
      defaultPageSize={10}
      selectable
      exportable
      rowActions={[
        { label: "View Profile", icon: <IcoEye />,   onClick: (c) => console.log("view", c.id) },
        { label: "Edit",         icon: <IcoEdit />,  onClick: (c) => console.log("edit", c.id) },
        { label: "Delete",       icon: <IcoTrash />, variant: "danger", onClick: (c) => console.log("delete", c.id) },
      ]}
      bulkActions={(selected) => (
        <button className="rounded border border-danger bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10">
          Delete {selected.length} customers
        </button>
      )}
      headerActions={
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-opacity-90">
          <IcoPlus /> Add Customer
        </button>
      }
    />
  );
}
