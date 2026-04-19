export interface OrdersResponse {
    statuses: string;
    summary: OrderSummary;
    data: OrderItem[];
    pagination: Pagination;
}

export interface OrderSummary {
    completed?: SummaryStatus;
    "on-hold"?: SummaryStatus;
    processing?: SummaryStatus;

    // Allow other statuses too
    [status: string]: SummaryStatus | undefined;
}

export interface SummaryStatus {
    order_count: number;
    item_count: number;
    total: number;
}

export interface OrderItem {
    order_id: number;
    order_number: string;
    order_status: OrderStatus;
    order_date: string;
    order_total: number;

    customer: Customer;

    bill1_status: BillStatus;
    bill1_amount: number;
    bill2_status: BillStatus;
    bill2_amount: number;

    item_id: number;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    total: number;
    discount: number;

    variation: VariationItem[];
    product: Product;
}

export interface Customer {
    id: number;
    name: string;
    email: string;
    phone: string;
}

export interface Product {
    id: number;
    type: ProductType;
    name: string;
    sku: string;
    price: number;
    regular_price: number;
    sale_price: number;
    stock: number | null;
    stock_status: StockStatus;
    categories: string[];
    tags: string[];
    attributes: ProductAttribute[];
    permalink: string;
    image: ProductImage;
}

export interface ProductAttribute {
    name: string;
    values: string[];
}

export interface ProductImage {
    thumbnail: string;
    medium: string;
    full: string;
}

export interface Pagination {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    total_items: number;
}

export type OrderStatus = "completed" | "on-hold" | "processing" | string;
export type BillStatus = "pending" | "paid" | "failed" | string;
export type ProductType = "simple" | "variable" | "variation" | string;
export type StockStatus = "instock" | "outofstock" | string;

// variation is currently always [] in your sample,
// so keep it flexible unless you know the exact shape
export type VariationItem = Record<string, unknown>;