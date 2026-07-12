import { Pagination } from './order.jaonaichan'

export interface CustomerListItem {
    id: number
    username: string
    name: string
    email: string
    phone: string
    role?: string
    status: 'active' | 'inactive'
    order_count: number
    total_spend: number
    member_date: string | null
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
