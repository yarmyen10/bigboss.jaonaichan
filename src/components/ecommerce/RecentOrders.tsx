import { useNavigate } from "react-router";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import Badge from "../ui/badge/Badge";
import type { Order } from "../../interfaces/order.jaonaichan";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";

interface Props {
  orders: Order[];
  loading: boolean;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function RecentOrders({ orders, loading }: Props) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Recent Orders
        </h3>
        <button
          onClick={() => navigate("/order-jaonaichan")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
        >
          See all
        </button>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              {["#Order", "Customer", "Total", "Status", "Date"].map((h) => (
                <TableCell key={h} isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableRow>
                <TableCell className="py-6 text-center text-gray-400 text-theme-sm" colSpan={5}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell className="py-6 text-center text-gray-400 text-theme-sm" colSpan={5}>
                  No orders
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const detail = ORDER_STATUS_DETAILS[order.status];
                return (
                  <TableRow key={order.id}>
                    <TableCell className="py-3 font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      #{order.number}
                    </TableCell>
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {order.customer.name || order.customer.email || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      ฿{order.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge size="sm" color={detail?.color ?? "light"}>
                        {detail?.text ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {fmtDate(order.date)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
