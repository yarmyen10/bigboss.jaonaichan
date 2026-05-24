import { Pagination } from './order.jaonaichan'

export interface CustomerListItem {
    id: number
    name: string
    email: string
    phone: string
    role?: string
    order_count: number
    total_spend: number
    last_order_date: string | null
}

export interface CustomerListResponse {
    data: CustomerListItem[]
    pagination: Pagination
}

export interface GetCustomersParams {
    page?: number
    perPage?: number
    search?: string
}
