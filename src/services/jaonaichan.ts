import { apiRequest } from "../api/client";
import { OrderDetailResponse, OrderListResponse, OrderProductsBulkResponse } from "../interfaces/order.jaonaichan";

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


