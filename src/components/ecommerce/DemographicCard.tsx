import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";

interface Props {
  breakdown: Record<string, number>;
  loading: boolean;
}

export default function DemographicCard({ breakdown, loading }: Props) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Order Status Breakdown
        </h3>
        <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
          All-time counts by status
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No data</p>
      ) : (
        <div className="space-y-4">
          {entries.map(([status, count]) => {
            const detail = ORDER_STATUS_DETAILS[status];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 text-theme-sm dark:text-white/90 truncate">
                    {detail?.text ?? status}
                  </p>
                  <div className="mt-1.5 relative h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                    {count.toLocaleString()}
                  </p>
                  <span className="text-gray-400 text-theme-xs">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
