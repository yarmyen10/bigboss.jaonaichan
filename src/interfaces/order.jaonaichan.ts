// =============================================================================
// Shared primitives
// =============================================================================

export type BillStatus = 'pending' | 'submitted' | 'paid' | 'cancelled'
export type OrderStatus = string // wc statuses e.g. 'processing' | 'completed' | 'on-hold' | ...

export interface Pagination {
    page: number
    per_page: number
    total: number
    total_pages: number
}

// =============================================================================
// Sub-objects
// =============================================================================

export interface Customer {
    id: number
    name: string
    email: string
    phone: string
}

export interface Billing {
    address: string
}

/** bill1 / bill2 — full version (มี paid_at) */
export interface Bill {
    status: BillStatus
    amount: number
    paid_at: string | null
    unit_prices?: Record<number, number>
    unit_prices_id?: string | null
}

/** bill1 / bill2 — summary version (ไม่มี paid_at) ใช้ใน bulk / flat */
export interface BillSummary {
    status: BillStatus
    amount: number
    unit_prices?: Record<number, number>
    unit_prices_id?: string | null
}

// =============================================================================
// Product
// =============================================================================

export interface ProductImage {
    thumbnail: string | null
    medium: string | null
    full: string | null
}

export interface ProductAttribute {
    name: string
    values: string[]
}

export interface OrderItemProduct {
    id: number
    type: string
    name: string
    sku: string
    price: number
    regular_price: number
    sale_price: number
    stock: number | null
    stock_status: string
    categories: string[]
    tags: string[]
    attributes: ProductAttribute[]
    permalink: string
    image: ProductImage
}

// =============================================================================
// Order Item
// =============================================================================

export interface OrderItemVariation {
    key: string
    value: string
}

export interface OrderItem {
    item_id: number
    name: string
    quantity: number
    unit_price: number
    subtotal: number
    total: number
    discount: number
    variation: OrderItemVariation[]
    product: OrderItemProduct
}

// =============================================================================
// Order  (แกนหลัก — ตรงกับ format_order())
// =============================================================================

export interface Order {
    id: number
    number: string
    status: OrderStatus
    total: number
    currency: string
    date: string
    date_modified?: string
    payment_method: string
    customer: Customer
    billing: Billing
    bill1: Bill
    bill2: Bill
    items?: OrderItem[] // มีเฉพาะ GET /orders/{id} (with_items = true)
}

// =============================================================================
// GET /orders
// =============================================================================

export interface OrderListResponse {
    data: Order[]
    pagination: Pagination
}

// =============================================================================
// GET /orders/{id}
// =============================================================================

export type OrderDetailResponse = Required<Order> // items เสมอ

// =============================================================================
// GET /orders/{id}/products
// =============================================================================

export interface OrderProductsResponse {
    id: number
    total: number
    bill1: Bill
    bill2: Bill
    items_summary: {
        count: number
        subtotal: number
        total_qty: number
    }
    items: OrderItem[]
}

// =============================================================================
// GET /orders/products?format=grouped
// =============================================================================

/** แต่ละ element คือ Order ที่มี items เสมอ (ไม่มี billing / payment_method) */
export interface OrderGrouped {
    id: number
    number: string
    status: OrderStatus
    total: number
    currency: string
    date: string
    customer: Customer
    bill1: Bill
    bill2: Bill
    items: OrderItem[]
}

export interface OrderProductsGroupedResponse {
    format: 'grouped'
    status: OrderStatus
    data: OrderGrouped[]
    pagination: Pagination
}

// =============================================================================
// GET /orders/products?format=flat
// =============================================================================

/** OrderItem + order reference fields */
export interface OrderProductsFlatItem extends OrderItem {
    id: number
    number: string
    status: OrderStatus
    date: string
    bill1: Pick<Bill, 'status'>
    bill2: Pick<Bill, 'status'>
}

export interface OrderProductsFlatResponse {
    format: 'flat'
    status: OrderStatus
    data: OrderProductsFlatItem[]
    pagination: Pagination
}

// =============================================================================
// GET /orders/products?format=grouped|flat  (union helper)
// =============================================================================

export type OrderProductsByStatusResponse =
    | OrderProductsGroupedResponse
    | OrderProductsFlatResponse

// =============================================================================
// GET /orders/products/bulk
// =============================================================================

/** OrderItem + order reference fields + bill amounts */
export interface OrderProductsBulkItem extends OrderItem {
    id: number
    number: string
    status: OrderStatus
    date: string
    total: number
    currency: string
    customer: Customer
    bill1: BillSummary
    bill2: BillSummary
}

export interface OrderProductsBulkSummaryEntry {
    order_count: number
    item_count: number
    total: number
}

export interface OrderProductsBulkResponse {
    statuses: string // raw query param e.g. "processing,completed" or "all"
    summary: Record<OrderStatus, OrderProductsBulkSummaryEntry>
    data: OrderProductsBulkItem[]
    pagination: Pagination & { total_items: number }
}

// =============================================================================
// PATCH responses
// =============================================================================

export interface PatchStatusResponse {
    success: true
    message: string
    data: Order
}

export interface PatchNoteResponse {
    success: true
    message: string
    note_id: number
}

export interface PatchCustomerResponse {
    success: true
    message: string
    updated: string[]
    data: Order
}

export interface PatchBillResponse {
    success: true
    message: string
    updated: Partial<Pick<Bill, 'status' | 'amount' | 'paid_at' | 'unit_prices' | 'unit_prices_id'>>
}

// =============================================================================
// Error responses
// =============================================================================

export interface ApiErrorResponse {
    success: false
    message: string
    valid_statuses?: string[]
}