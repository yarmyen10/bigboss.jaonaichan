import { useEffect, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

export default function Order() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Simulate loading state for demonstration
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100); // Simulate a 5-second loading time
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <PageMeta
        title="React.js Order Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Order Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Order Jaonaichan" />
      <CardFrame isLoading={isLoading}>
        <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
          <div className="mx-auto w-full max-w-[630px] text-center">
            <h3 className="mb-4 font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
              Card Title Here
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
              Start putting content on grids or panels, you can also use different
              combinations of grids.Please check out the dashboard and other pages
            </p>
          </div>
        </div>
      </CardFrame>
    </div>
  );
}
