import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import type { MonthlyRevenueRow } from "../../interfaces/dashboard.jaonaichan";

interface Props {
  monthly: MonthlyRevenueRow[];
  loading: boolean;
}

export default function MonthlySalesChart({ monthly, loading }: Props) {
  const categories = monthly.length
    ? monthly.map((r) => r.label)
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const data = monthly.map((r) => r.revenue);

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ["transparent"] },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: { show: false },
    yaxis: {
      labels: {
        formatter: (v) =>
          v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`,
      },
    },
    grid: { yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: {
      x: { show: false },
      y: { formatter: (v) => `฿${v.toLocaleString()}` },
    },
  };

  const series = [{ name: "Revenue (฿)", data }];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Monthly Revenue
        </h3>
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
              Loading…
            </div>
          ) : (
            <Chart options={options} series={series} type="bar" height={180} />
          )}
        </div>
      </div>
    </div>
  );
}
