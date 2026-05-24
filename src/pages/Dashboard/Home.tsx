import { useEffect, useRef, useState } from "react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import DemographicCard from "../../components/ecommerce/DemographicCard";
import PageMeta from "../../components/common/PageMeta";
import { getDashboardStats } from "../../services/jaonaichan";
import type { DashboardStats } from "../../interfaces/dashboard.jaonaichan";

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageMeta
        title="Dashboard | BigBoss Admin"
        description="BigBoss admin dashboard overview"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-7">
          <EcommerceMetrics metrics={stats?.metrics ?? null} loading={loading} />
          <MonthlySalesChart monthly={stats?.monthly_revenue ?? []} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <MonthlyTarget metrics={stats?.metrics ?? null} loading={loading} />
        </div>

        <div className="col-span-12">
          <StatisticsChart monthly={stats?.monthly_revenue ?? []} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <DemographicCard breakdown={stats?.status_breakdown ?? {}} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders orders={stats?.recent_orders ?? []} loading={loading} />
        </div>
      </div>
    </>
  );
}
