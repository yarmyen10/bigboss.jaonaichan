import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import type { MonthlyRevenueRow } from "../../interfaces/dashboard.jaonaichan";

interface Props {
  monthly: MonthlyRevenueRow[];
  loading: boolean;
}

export default function StatisticsChart({ monthly, loading }: Props) {
  const categories = monthly.length
    ? monthly.map((r) => r.label)
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const options: ApexOptions = {
    legend: { show: true, position: "top", horizontalAlign: "left" },
    colors: ["#465FFF", "#9CB9FF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line",
      toolbar: { show: false },
    },
    stroke: { curve: "straight", width: [2, 2] },
    fill: {
      type: "gradient",
      gradient: { opacityFrom: 0.55, opacityTo: 0 },
    },
    markers: {
      size: 0,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: { size: 6 },
    },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: { enabled: false },
    tooltip: { enabled: true },
    xaxis: {
      type: "category",
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: [
      {
        seriesName: "Orders",
        title: { text: "Orders" },
        labels: { style: { fontSize: "12px", colors: ["#6B7280"] } },
      },
      {
        seriesName: "Revenue (฿)",
        opposite: true,
        title: { text: "Revenue (฿)" },
        labels: {
          style: { fontSize: "12px", colors: ["#6B7280"] },
          formatter: (v) => v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`,
        },
      },
    ],
  };

  const series = [
    { name: "Orders", data: monthly.map((r) => r.orders) },
    { name: "Revenue (฿)", data: monthly.map((r) => r.revenue) },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Orders & Revenue
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Monthly breakdown for the year
          </p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[1000px] xl:min-w-full">
          {loading ? (
            <div className="h-[310px] flex items-center justify-center text-gray-400 text-sm">
              Loading…
            </div>
          ) : (
            <Chart options={options} series={series} type="area" height={310} />
          )}
        </div>
      </div>
    </div>
  );
}
