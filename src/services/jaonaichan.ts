import { apiRequest } from "../api/client";
import { OrderListResponse } from "../interfaces/order.jaonaichan";

export async function getOrders(page = 1, perPage = 10): Promise<OrderListResponse> {
    return apiRequest(`/jaonaichan/v1/orders?page=${page}&per_page=${perPage}`);
}

export async function getProductsBulk(statuses = "all", page = 1, perPage = 10): Promise<any> {
    return apiRequest(`/jaonaichan/v1/orders/products/bulk?statuses=${statuses}&page=${page}&per_page=${perPage}`);
}
