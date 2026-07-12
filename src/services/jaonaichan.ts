import { apiFetch, apiRequest } from "../api/client";
import { OrderDetailResponse, OrderListResponse, OrderProductsBulkResponse, PatchBillResponse } from "../interfaces/order.jaonaichan";
import type { DashboardStats } from '../interfaces/dashboard.jaonaichan';
import { PatchProfilePayload, PatchProfileResponse, UserProfile } from "../interfaces/profile.jaonaichan";
import type { InvoiceLineItem } from "../interfaces/invoice.jaonaichan";

export interface GetOrdersParams {
    page?: number;
    perPage?: number;
    status?: string;
    /** exact date override — dd/mm/yyyy, takes precedence over month/year */
    createDate?: string;
    createDateM?: number;
    createDateY?: number;
    unitPricesId?: string;
    lotId?: number;
    memberNo?: number;
    username?: string;
}

export async function getOrders(params: GetOrdersParams = {}): Promise<OrderListResponse> {
    const { page = 1, perPage = 10, status, createDate, createDateM, createDateY, unitPricesId, lotId, memberNo, username } = params;
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) qs.set("status", status);
    if (unitPricesId) qs.set("unit_prices_id", unitPricesId);
    if (lotId) qs.set("lot_id", String(lotId));
    if (memberNo) qs.set("member_no", String(memberNo));
    if (username) qs.set("username", username);
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

export async function deleteOrder(id: number): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/orders/${id}`, {
        method: "DELETE",
    });
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

export async function patchBill2(
    orderId: number,
    amount: number,
    status?: string,
    paidAt?: string,
    unitPrices?: Record<number, number>,
    unitPricesId?: string,
    // {product_id: amount} — same shape as unitPrices, so we can see which product
    // contributed how much to this order's china shipping / import fee.
    chinaShipping?: Record<number, number>,
    importFee?: Record<number, number>,
    localShipping?: number
): Promise<PatchBillResponse> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/bill/2`, {
        method: "PATCH",
        body: JSON.stringify({
            amount,
            ...(status && { status }),
            ...(paidAt && { paid_at: paidAt }),
            ...(unitPrices && { unit_prices: unitPrices }),
            ...(unitPricesId && { unit_prices_id: unitPricesId }),
            ...(chinaShipping && { china_shipping: chinaShipping }),
            ...(importFee && { import_fee: importFee }),
            ...(localShipping !== undefined && { local_shipping: localShipping }),
        }),
    });
}

export async function patchOrderStatus(orderId: number, status: string): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });
}

export async function deleteBill2Batch(batchId: string): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/bill2-batch/${batchId}`, {
        method: "DELETE",
    });
}

export async function patchOrderShipping(orderId: number, shipping: { name: string, phone: string, address: string }): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/shipping`, {
        method: "PATCH",
        body: JSON.stringify({
            shipping_name: shipping.name,
            shipping_phone: shipping.phone,
            shipping_address: shipping.address,
        }),
    });
}

export async function patchOrderInvoiceItems(orderId: number, items: InvoiceLineItem[]): Promise<unknown> {
    return apiRequest(`/jaonaichan/v1/orders/${orderId}/invoice-items`, {
        method: "PATCH",
        body: JSON.stringify({ items }),
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

export async function createCustomer(payload: { username: string; customer_name: string; phone: string; email?: string; status?: 'active' | 'inactive' }): Promise<{ success: boolean; data: any; message?: string }> {
    return apiRequest('/jaonaichan/v1/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateCustomer(id: number, payload: { username: string; customer_name: string; phone: string; email?: string }): Promise<{ success: boolean; data?: any; message?: string }> {
    return apiRequest(`/jaonaichan/v1/customers/${id}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function setCustomerStatus(id: number, status: 'active' | 'inactive'): Promise<{ success: boolean; message?: string }> {
    return apiRequest(`/jaonaichan/v1/customers/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function resetCustomerPassword(id: number, payload: { mode: 'phone' | 'manual'; password?: string }): Promise<{ success: boolean; message?: string }> {
    return apiRequest(`/jaonaichan/v1/customers/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload),
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
    BarcodeListResponse,
    BarcodeDeleteResponse,
    TrackingParcel,
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
    scanned: Record<number, string[]>,
    lotId?: number
): Promise<ConfirmPackResponse> {
    return apiRequest(BARCODE_PACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm_pack', order_id: orderId, scanned, lot_id: lotId }),
    });
}

export async function saveTracking(
    orderId: number,
    parcels: TrackingParcel[]
): Promise<{ success: boolean }> {
    return apiRequest(BARCODE_PACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_tracking', order_id: orderId, parcels }),
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

export async function saveBarcodeImport(productId: number, barcode: string, imageBase64?: string): Promise<BarcodeImportSaveResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_barcode', product_id: productId, barcode, image: imageBase64 }),
    });
}

export async function getBarcodes(page = 1, perPage = 20, search?: string, productId?: number): Promise<BarcodeListResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_barcodes', page, per_page: perPage, search, product_id: productId }),
    });
}

export async function deleteBarcode(id: number): Promise<BarcodeDeleteResponse> {
    return apiRequest(BARCODE_IMPORT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_barcode', id }),
    });
}

// =========================================================================
// Lots
// =========================================================================

import type { Lot } from '../interfaces/lot.jaonaichan';

export async function getLots(): Promise<Lot[]> {
    return apiRequest('/jaonaichan/v1/lots');
}

export async function createLot(): Promise<Lot> {
    return apiRequest('/jaonaichan/v1/lots', { method: 'POST' });
}

// =========================================================================
// Invoices
// =========================================================================

import type { InvoiceListResponse, SaveInvoicePayload, SaveInvoiceResponse, InvoiceRecord } from '../interfaces/invoice.jaonaichan';

export async function saveInvoice(payload: SaveInvoicePayload): Promise<SaveInvoiceResponse> {
    return apiRequest('/jaonaichan/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getInvoices(params: { page?: number; perPage?: number; search?: string } = {}): Promise<InvoiceListResponse> {
    const { page = 1, perPage = 20, search } = params;
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) qs.set("search", search);
    return apiRequest(`/jaonaichan/v1/invoices?${qs}`);
}

export async function getInvoice(id: number): Promise<{ success: boolean; data: InvoiceRecord }> {
    return apiRequest(`/jaonaichan/v1/invoices/${id}`);
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

// =========================================================================
// Social Login Plugin Settings
// =========================================================================

import type { SocialLoginSettings, SocialLoginSettingsApiResponse } from '../interfaces/social-login.jaonaichan';

export async function getSocialLoginSettings(): Promise<SocialLoginSettings> {
    const res = await apiRequest<SocialLoginSettingsApiResponse>('/bigboss-auth/v1/social-login-settings');
    return res.data;
}

export async function updateSocialLoginSettings(payload: Partial<SocialLoginSettings>): Promise<SocialLoginSettingsApiResponse> {
    return apiRequest('/bigboss-auth/v1/social-login-settings', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// =========================================================================
// RTS Shipping Settings
// =========================================================================

export interface RtsShippingSettings {
    zone_name: string;
    method_title: string;
    cost: number;
    instance_id: number | null;
}

export async function getRtsShippingSettings(): Promise<RtsShippingSettings> {
    return apiRequest('/jaonaichan/v1/settings/rts-shipping');
}

export async function updateRtsShippingSettings(cost: number): Promise<{ success: boolean; cost: number }> {
    return apiRequest('/jaonaichan/v1/settings/rts-shipping', {
        method: 'POST',
        body: JSON.stringify({ cost }),
    });
}
