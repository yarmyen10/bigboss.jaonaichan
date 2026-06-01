export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceRecord {
  id: number;
  invoice_number: string;
  invoice_date: string;
  customer_ids: number[];
  items: InvoiceLineItem[];
  total: number;
  notes: string;
  status: 'draft' | 'sent' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface SaveInvoicePayload {
  invoice_number: string;
  invoice_date: string;
  customer_ids: number[];
  items: InvoiceLineItem[];
  total: number;
  notes: string;
  status: 'draft' | 'sent' | 'paid';
}

export interface SaveInvoiceResponse {
  success: boolean;
  data: InvoiceRecord;
}

export interface InvoiceListResponse {
  data: InvoiceRecord[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
