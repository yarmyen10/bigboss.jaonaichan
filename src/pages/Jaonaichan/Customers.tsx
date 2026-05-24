import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DataTableOne, { ColumnDef } from "../../components/tables/DataTable/DataTableOne";
import { CustomerListItem } from "../../interfaces/customer.jaonaichan";
import { Order as OrderIF } from "../../interfaces/order.jaonaichan";
import Badge, { BadgeColor } from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import { getCustomers, getCustomerOrders } from "../../services/jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";


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

const orderHistoryColumns: ColumnDef<OrderIF>[] = [
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
    width: "160px",
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
];

export default function Customers() {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const hasInitialized = useRef(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderIF[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await getCustomers();
      setCustomers(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error(error);
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
    openModal();
    try {
      setIsOrdersLoading(true);
      const res = await getCustomerOrders(customer.id);
      setCustomerOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [openModal]);

  const columns = useMemo(() => customerColumns, []);
  const orderCols = useMemo(() => orderHistoryColumns, []);

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
                <h4 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
                  {selectedCustomer.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCustomer.email}</p>
                {selectedCustomer.phone && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCustomer.phone}</p>
                )}
                <div className="mt-3 flex gap-4">
                  <div className="text-sm">
                    <span className="text-gray-400">Orders: </span>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {selectedCustomer.order_count}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Total Spend: </span>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      ฿{selectedCustomer.total_spend.toLocaleString()}
                    </span>
                  </div>
                </div>
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
    </>
  );
}
