import { apiFetch, apiRequest } from "../api/client";
import { OrderDetailResponse, OrderListResponse, OrderProductsBulkResponse, PatchBillResponse } from "../interfaces/order.jaonaichan";
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
