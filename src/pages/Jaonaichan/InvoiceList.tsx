import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DataTableOne, { ColumnDef, FetchParams, FetchResult } from "../../components/tables/DataTable/DataTableOne";
import { InvoiceRecord } from "../../interfaces/invoice.jaonaichan";
import { getInvoices } from "../../services/jaonaichan";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import { PlusIcon } from "../../icons";

function fmt(n: number) {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceListPage() {
  const navigate = useNavigate();

  const fetchFn = useCallback(async (params: FetchParams): Promise<FetchResult<InvoiceRecord>> => {
    const res = await getInvoices({
      page: params.page,
      perPage: params.pageSize,
      search: params.search,
    });
    return { data: res.data, total: res.total };
  }, []);

  const columns = useMemo<ColumnDef<InvoiceRecord>[]>(() => [
    {
      key: "invoice_number",
      label: "Invoice #",
      sortable: false,
      render: (v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/jaonaichan/invoice?id=${row.id}`);
          }}
          className="text-brand-500 hover:underline font-mono"
        >
          {row.invoice_number}
        </button>
      ),
    },
    {
      key: "invoice_date",
      label: "Date",
      sortable: false,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      sortable: false,
      render: (v) => <span className="font-medium text-gray-900 dark:text-white">{fmt(v as number)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (v) => {
        const s = v as string;
        if (s === "paid") return <Badge color="success">Paid</Badge>;
        if (s === "sent") return <Badge color="warning">Sent</Badge>;
        return <Badge color="light">Draft</Badge>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      sortable: false,
      render: (v, row) => (
        <Button size="sm" variant="outline" onClick={(e) => {
          e.stopPropagation();
          navigate(`/jaonaichan/invoice?id=${row.id}`);
        }}>
          View
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageMeta title="Invoices List" description="Manage standalone invoices" />
      <PageBreadcrumb pageTitle="Invoices (Standalone)" />
      
      <div className="flex justify-end mb-4">
        <Button size="sm" startIcon={<PlusIcon className="size-5" />} onClick={() => navigate("/jaonaichan/invoice")}>
          Create New Invoice
        </Button>
      </div>

      <DataTableOne<InvoiceRecord>
        rowKey="id"
        columns={columns}
        fetchFn={fetchFn}
        searchable="toolbar"
        searchPlaceholder="Search by invoice number..."
        onRowClick={(row) => navigate(`/jaonaichan/invoice?id=${row.id}`)}
      />
    </>
  );
}
