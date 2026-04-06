export interface OrderItem {
    id: number;
    name: string;
    quantity: number;
    total: number;
    product: {
        image: {
            thumbnail: string;
            medium: string;
            full: string;
        }
    }
}

export interface Order {
    id: number;
    number: string;
    status: string;
    total: number;
    date: string;
    customer: { name: string; email: string; };
    bill1: { status: string; amount: number; };
    bill2: { status: string; amount: number; };
    items?: OrderItem[];
}

export interface OrdersResponse {
    data: Order[];
    pagination: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}