import { useState, useMemo, useEffect, useRef } from "react";
import { Order as OrderIF, OrderListResponse } from "../../interfaces/order.jaonaichan";
import { getOrders } from "../../services/jaonaichan";

export const TAB_STATUS: Record<string, string | undefined> = {
  all: undefined,
  unpaid: "waiting-transfer,pending-payment-1,wait-verify-1,pending-payment-2,wait-verify-2",
  paid: "paid-1,paid-2,completed",
};

export interface DateFilter {
  month: string;
  year: string;
  date: string;
}

export function useOrderList() {
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [orders, setOrders] = useState<OrderIF[]>([]);

  const [dateFilter, setDateFilter] = useState<DateFilter>(() => ({
    month: "",
    year: String(new Date().getFullYear()),
    date: "",
  }));

  const [statusTab, setStatusTab] = useState<string>("all");

  const [searchType, setSearchType] = useState<"general" | "batch" | "lot">("general");
  const [searchValue, setSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchValue]);

  const displayOrders = useMemo(() => {
    if (searchType === "general" && debouncedSearchValue) {
      const q = debouncedSearchValue.toLowerCase();
      return orders.filter(row =>
        String(row.id).toLowerCase().includes(q) ||
        row.customer.name.toLowerCase().includes(q) ||
        row.customer.email.toLowerCase().includes(q) ||
        (row.number && row.number.toLowerCase().includes(q))
      );
    }
    return orders;
  }, [orders, searchType, debouncedSearchValue]);

  const lastFetchedBatchId = useRef("");

  const loadOrders = async (
    filter: DateFilter,
    tab: string = statusTab,
    bId: string = searchType === "batch" ? debouncedSearchValue : "",
    lId: string = searchType === "lot" ? debouncedSearchValue : ""
  ) => {
    lastFetchedBatchId.current = bId;
    try {
      setIsLoading(true);
      const res: OrderListResponse = await getOrders({
        ...(filter.date
          ? { createDate: filter.date }
          : {
            ...(filter.month ? { createDateM: Number(filter.month) } : {}),
            ...(filter.year ? { createDateY: Number(filter.year) } : {}),
          }),
        ...(TAB_STATUS[tab] ? { status: TAB_STATUS[tab] } : {}),
        ...(bId ? { unitPricesId: bId } : {}),
        ...(lId ? { lotId: Number(lId) } : {}),
      });
      setOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  };

  const handleFilterChange = (newFilter: DateFilter) => {
    setDateFilter(newFilter);
    loadOrders(newFilter);
  };

  const handleTabChange = (tab: string) => {
    setStatusTab(tab);
    loadOrders(dateFilter, tab);
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadOrders(dateFilter);
  }, []);

  useEffect(() => {
    if (!hasInitialized.current) return;

    const targetBatchId = searchType === "batch" ? debouncedSearchValue : "";
    const targetLotId   = searchType === "lot"   ? debouncedSearchValue : "";
    if (targetBatchId !== lastFetchedBatchId.current) {
      loadOrders(dateFilter, statusTab, targetBatchId, targetLotId);
    } else if (searchType === "lot") {
      loadOrders(dateFilter, statusTab, "", targetLotId);
    }
  }, [debouncedSearchValue, searchType]);

  return {
    orders,
    displayOrders,
    isLoading,
    dateFilter,
    handleFilterChange,
    statusTab,
    handleTabChange,
    searchType,
    setSearchType,
    searchValue,
    setSearchValue,
    debouncedSearchValue,
    loadOrders
  };
}
