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
  dateFrom: string; // dd/mm/yyyy
  dateTo: string;   // dd/mm/yyyy
}

export function useOrderList() {
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [orders, setOrders] = useState<OrderIF[]>([]);

  const [dateFilter, setDateFilter] = useState<DateFilter>(() => ({
    month: "",
    year: String(new Date().getFullYear()),
    dateFrom: "",
    dateTo: "",
  }));

  const [statusTab, setStatusTab] = useState<string>("all");

  const [searchType, setSearchType] = useState<"general" | "batch" | "lot" | "status">("general");
  const [searchValue, setSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [rtsFilter, setRtsFilter] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchValue]);

  const displayOrders = useMemo(() => {
    let result = orders;
    if (searchType === "general" && debouncedSearchValue) {
      const q = debouncedSearchValue.toLowerCase();
      result = result.filter(row =>
        String(row.id).toLowerCase().includes(q) ||
        row.customer.name.toLowerCase().includes(q) ||
        row.customer.email.toLowerCase().includes(q) ||
        (row.number && row.number.toLowerCase().includes(q))
      );
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(row => selectedStatuses.includes(row.status));
    }
    if (rtsFilter) {
      result = result.filter(row => row.is_rts);
    }
    return result;
  }, [orders, searchType, debouncedSearchValue, selectedStatuses, rtsFilter]);

  const lastFetchedBatchId = useRef("");

  const loadOrders = async (
    filter: DateFilter,
    tab: string = statusTab,
    bId: string = searchType === "batch" ? debouncedSearchValue : "",
    lId: string = searchType === "lot" ? debouncedSearchValue : ""
  ) => {
    lastFetchedBatchId.current = bId;
    const PER_PAGE = 50;
    const baseParams = {
      perPage: PER_PAGE,
      ...(filter.dateFrom || filter.dateTo
        ? {
          ...(filter.dateFrom ? { createDateAfter: filter.dateFrom } : {}),
          ...(filter.dateTo ? { createDateBefore: filter.dateTo } : {}),
        }
        : {
          ...(filter.month ? { createDateM: Number(filter.month) } : {}),
          ...(filter.year ? { createDateY: Number(filter.year) } : {}),
        }),
      ...(TAB_STATUS[tab] ? { status: TAB_STATUS[tab] } : {}),
      ...(bId ? { unitPricesId: bId } : {}),
      ...(lId ? { lotId: Number(lId) } : {}),
    };

    try {
      setIsLoading(true);
      const first = await getOrders({ ...baseParams, page: 1 });
      const allOrders = Array.isArray(first?.data) ? [...first.data] : [];
      const totalPages = first?.pagination?.total_pages ?? 1;

      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            getOrders({ ...baseParams, page: i + 2 })
          )
        );
        for (const r of rest) {
          if (Array.isArray(r?.data)) allOrders.push(...r.data);
        }
      }

      setOrders(allOrders);
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
    selectedStatuses,
    setSelectedStatuses,
    rtsFilter,
    setRtsFilter,
    loadOrders
  };
}
