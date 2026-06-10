import { apiFetch, apiRequest } from "../api/client";
import { OrderDetailResponse, OrderListResponse, OrderProductsBulkResponse, PatchBillResponse } from "../interfaces/order.jaonaichan";
import type { DashboardStats } from '../interfaces/dashboard.jaonaichan';
import { PatchProfilePayload, PatchProfileResponse, UserProfile } from "../interfaces/profile.jaonaichan";

export interface GetOrdersParams {
    page?: number;
    perPage?: number;
    status?: string;
    /** exact date override — dd/mm/yyyy, takes precedence over month/year */
    createDate?: string;
    createDateM?: number;
    createDateY?: number;
}

export async function getOrders(params: GetOrdersParams = {}): Promise<OrderListResponse> {
    const { page = 1, perPage = 10, status, createDate, createDateM, createDateY } = params;
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) qs.set("status", status);
    if (createDate) {
        qs.set("create_date", createDate);
    } else {
        if (createDateM) qs.set("create_date_m", String(createDateM));
        if (createDateY) qs.set("create_date_y", String(createDateY));
    }
    return apiRequest(`/jaonaichan/v1/orders?${qs}`);
}

export async function getOrder(id: number): Promise<OrderDetailResponse> {
    return apiRequest(`/jaonaichan/v1/orders/${id}?with_items=true`);
}

export async function getProductsBulk(statuses = "all", page = 1, perPage = 10): Promise<any> {
    return apiRequest(`/jaonaichan/v1/orders/products/bulk?statuses=${statuses}&page=${page}&per_page=${perPage}`);
}

export interface GetProductsBulkByOrdersParams {
    orderIds: number[];
    statuses?: string;
    page?: number;
    perPage?: number;
}

export async function getBillSlipObjectUrl(orderId: number, bill: 1 | 2): Promise<string | null> {
    const res = await apiFetch(`/promptpay/v1/slip/${orderId}/${bill}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

export async function deleteSlip(orderId: number, bill: 1 | 2): Promise<unknown> {
    return apiRequest(`/promptpay/v1/slip/${orderId}/${bill}`, {
        method: "DELETE",
    });
}

export async function reVerifySlip(orderId: number, bill: 1 | 2): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/promptpay/v1/re-verify/${orderId}/${bill}`, {
        method: "POST",
    });
}

export async function patchBill2(orderId: number, amount: number, status?: string, paidAt?: string, unitPrices?: Record<number, number>, unitPricesId?: string): Promise<PatchBillResponse> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/bill/2`, {
        method: "PATCH",
        body: JSON.stringify({
            amount,
            ...(status && { status }),
            ...(paidAt && { paid_at: paidAt }),
            ...(unitPrices && { unit_prices: unitPrices }),
            ...(unitPricesId && { unit_prices_id: unitPricesId }),
        }),
    });
}

export async function patchOrderStatus(orderId: number, status: string): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });
}

export async function getProductsBulkByOrders({
    orderIds,
    statuses,
    page = 1,
    perPage = 20,
}: GetProductsBulkByOrdersParams): Promise<OrderProductsBulkResponse> {
    return apiRequest("/jaonaichan/v1/orders/products/bulk", {
        method: "POST",
        body: JSON.stringify({
            order_ids: orderIds,
            ...(statuses !== undefined && { statuses }),
            page,
            per_page: perPage,
        }),
    });
}

// =========================================================================
// Dashboard
// =========================================================================

export async function getDashboardStats(year?: number): Promise<DashboardStats> {
    const qs = year ? `?year=${year}` : '';
    return apiRequest(`/jaonaichan/v1/dashboard${qs}`);
}

// =========================================================================
// Customers
// =========================================================================

import type { CustomerListResponse, GetCustomersParams } from '../interfaces/customer.jaonaichan';

export async function getCustomers(params: GetCustomersParams = {}): Promise<CustomerListResponse> {
    const { page = 1, perPage = 20, search } = params;
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) qs.set('search', search);
    return apiRequest(`/jaonaichan/v1/customers?${qs}`);
}

export async function getCustomerOrders(customerId: number): Promise<OrderListResponse> {
    return apiRequest(`/jaonaichan/v1/customers/${customerId}/orders`);
}

// =========================================================================
// Barcode Pack
// =========================================================================

import type {
    BarcodeImportSaveResponse,
    ConfirmPackResponse,
    GetOrderItemsResponse,
    GetVariationsResponse,
    ProductSearchResponse,
    ValidateBarcodeResponse,
} from '../interfaces/barcode.jaonaichan';

const BARCODE_PACK_ENDPOINT = '/jaonaichan/v1/barcode-pack';

export async function getBarcodeOrderItems(orderId: number): Promise<GetOrderItemsResponse> {
    return apiRequest(BARCODE_PACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_order_items', order_id: orderId }),
    });
}

export async function validateBarcode(barcode: string): Promise<ValidateBarcodeResponse> {
    return apiRequest(BARCODE_PACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'validate_barcode', barcode }),
    });
}

export async function confirmPack(
    orderId: number,
    scanned: Record<number, string[]>
): Promise<ConfirmPackResponse> {
    return apiRequest(BARCODE_PACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm_pack', order_id: orderId, scanned }),
    });
}

// =========================================================================
// Barcode Import
// =========================================================================

const BARCODE_IMPORT_ENDPOINT = '/jaonaichan/v1/barcode-import';

export async function searchProductsForImport(query: string): Promise<ProductSearchResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'search_products', query }),
    });
}

export async function getProductVariations(productId: number): Promise<GetVariationsResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_variations', product_id: productId }),
    });
}

export async function saveBarcodeImport(productId: number, barcode: string): Promise<BarcodeImportSaveResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_barcode', product_id: productId, barcode }),
    });
}

// =========================================================================
// Invoices
// =========================================================================

import type { InvoiceListResponse, SaveInvoicePayload, SaveInvoiceResponse } from '../interfaces/invoice.jaonaichan';

export async function saveInvoice(payload: SaveInvoicePayload): Promise<SaveInvoiceResponse> {
    return apiRequest('/jaonaichan/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getInvoices(params: { page?: number; perPage?: number } = {}): Promise<InvoiceListResponse> {
    const { page = 1, perPage = 20 } = params;
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    return apiRequest(`/jaonaichan/v1/invoices?${qs}`);
}

// =========================================================================
// Profile
// =========================================================================

function mapProfile(raw: Record<string, unknown>): UserProfile {
    return {
        id:           raw.id as number,
        username:     raw.username as string,
        email:        raw.email as string,
        displayName:  raw.display_name as string,
        firstName:    (raw.first_name as string) ?? "",
        lastName:     (raw.last_name as string) ?? "",
        nickname:     (raw.nickname as string) ?? "",
        description:  (raw.description as string) ?? "",
        registeredAt: raw.registered_at as string,
        roles:        raw.roles as string[],
        role:         raw.role as string,
        avatarUrl:    raw.avatar_url as string,
    };
}

export async function getProfile(): Promise<UserProfile> {
    const raw = await apiRequest<Record<string, unknown>>("/bigboss-auth/v1/profile");
    return mapProfile(raw);
}

export async function patchProfile(payload: PatchProfilePayload): Promise<PatchProfileResponse> {
    const raw = await apiRequest<{
        success: boolean;
        message: string;
        updated: string[];
        data: Record<string, unknown>;
    }>("/bigboss-auth/v1/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    return { ...raw, data: mapProfile(raw.data) };
}

// =========================================================================
// PromptPay QR Plugin Config
// =========================================================================

import type { PromptPayConfig, UpdatePromptPayConfigResponse } from '../interfaces/promptpay.jaonaichan';

export interface PromptPayQRResponse {
    phone: string;
    amount: number;
    qr_url: string;
}

export interface VerifySlipResponse {
    success: boolean;
    message: string;
    redirect?: string;
}

export async function getPromptPayConfig(): Promise<PromptPayConfig> {
    return apiRequest('/promptpay/v1/config');
}

export async function getPromptPayQR(amount: number): Promise<PromptPayQRResponse> {
    return apiRequest(`/promptpay/v1/qr?amount=${amount}`);
}

export async function verifySlipForInvoice(file: File, amount: number): Promise<VerifySlipResponse> {
    const form = new FormData();
    form.append('slip', file);
    form.append('amount', String(amount));
    const res = await apiFetch('/promptpay/v1/verify-slip', { method: 'POST', body: form });
    return res.json();
}

export async function patchInvoice(id: number, status: 'draft' | 'sent' | 'paid'): Promise<SaveInvoiceResponse> {
    return apiRequest(`/jaonaichan/v1/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function updatePromptPayConfig(payload: Partial<PromptPayConfig>): Promise<UpdatePromptPayConfigResponse> {
    return apiRequest('/promptpay/v1/config', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
