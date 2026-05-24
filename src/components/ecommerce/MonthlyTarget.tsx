import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import type { DashboardMetrics } from "../../interfaces/dashboard.jaonaichan";

interface Props {
  metrics: DashboardMetrics | null;
  loading: boolean;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

export default function MonthlyTarget({ metrics, loading }: Props) {
  const thisMonth = metrics?.this_month_revenue ?? 0;
  const lastMonth = metrics?.last_month_revenue ?? 0;
  const today = metrics?.today_revenue ?? 0;

  const pct = lastMonth > 0
    ? Math.min(100, Math.round((thisMonth / lastMonth) * 100))
    : thisMonth > 0 ? 100 : 0;

  const series = [pct];
  const options: ApexOptions = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "radialBar",
      height: 330,
      sparkline: { enabled: true },
    },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: { size: "80%" },
        track: { background: "#E4E7EC", strokeWidth: "100%", margin: 5 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: "36px",
            fontWeight: "600",
            offsetY: -40,
            color: "#1D2939",
            formatter: (val) => `${val}%`,
          },
        },
      },
    },
    fill: { type: "solid", colors: ["#465FFF"] },
    stroke: { lineCap: "round" },
    labels: ["vs Last Month"],
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 pt-5 bg-white shadow-default rounded-2xl pb-11 dark:bg-gray-900 sm:px-6 sm:pt-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Monthly Revenue
            </h3>
            <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
              This month vs last month
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="max-h-[330px]">
            {loading ? (
              <div className="h-[330px] flex items-center justify-center text-gray-400 text-sm">
                Loading…
              </div>
            ) : (
              <Chart options={options} series={series} type="radialBar" height={330} />
            )}
          </div>
          {!loading && (
            <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[95%] rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-600 dark:bg-success-500/15 dark:text-success-500">
              {fmt(thisMonth)}
            </span>
          )}
        </div>

        <p className="mx-auto mt-10 w-full max-w-[380px] text-center text-sm text-gray-500 sm:text-base">
          {loading
            ? "Loading…"
            : lastMonth > 0
            ? `This month is ${pct}% of last month's revenue`
            : "No data from last month"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Last Month
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? "—" : fmt(lastMonth)}
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800" />

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            This Month
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? "—" : fmt(thisMonth)}
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800" />

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Today
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? "—" : fmt(today)}
          </p>
        </div>
      </div>
    </div>
  );
}
