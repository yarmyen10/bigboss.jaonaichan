import { BoxIconLine, GroupIcon } from "../../icons";
import Badge from "../ui/badge/Badge";
import type { DashboardMetrics } from "../../interfaces/dashboard.jaonaichan";

interface Props {
  metrics: DashboardMetrics | null;
  loading: boolean;
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export default function EcommerceMetrics({ metrics, loading }: Props) {
  const orderPct = metrics ? pctChange(metrics.this_month_orders, metrics.last_month_orders) : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Customers</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {loading ? "—" : (metrics?.total_customers ?? 0).toLocaleString()}
            </h4>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Orders this month</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {loading ? "—" : (metrics?.this_month_orders ?? 0).toLocaleString()}
            </h4>
          </div>
          {!loading && orderPct !== null && (
            <Badge color={orderPct >= 0 ? "success" : "error"}>
              {orderPct >= 0 ? "+" : ""}{orderPct}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
