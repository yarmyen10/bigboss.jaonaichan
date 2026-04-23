import { apiRequest } from "../api/client";
import { OrderListResponse, OrderProductsBulkResponse } from "../interfaces/order.jaonaichan";

export async function getOrders(page = 1, perPage = 10): Promise<OrderListResponse> {
    return apiRequest(`/jaonaichan/v1/orders?page=${page}&per_page=${perPage}`);
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


