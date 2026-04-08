import { apiRequest } from "../api/client";
import { OrdersResponse } from "../interfaces/order.jaonaichan";

export async function getOrders(page = 1, per_page = 10): Promise<OrdersResponse> {
    return apiRequest(`/jaonaichan/v1/orders?page=${page}&per_page=${per_page}`);
}