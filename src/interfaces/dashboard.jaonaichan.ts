import type { Order } from './order.jaonaichan';

export interface DashboardMetrics {
    total_orders: number;
    total_customers: number;
    this_month_revenue: number;
    last_month_revenue: number;
    today_revenue: number;
    this_month_orders: number;
    last_month_orders: number;
}

export interface MonthlyRevenueRow {
    month: number;
    label: string;
    revenue: number;
    orders: number;
}

export interface DashboardStats {
    metrics: DashboardMetrics;
    monthly_revenue: MonthlyRevenueRow[];
    recent_orders: Order[];
    status_breakdown: Record<string, number>;
}
