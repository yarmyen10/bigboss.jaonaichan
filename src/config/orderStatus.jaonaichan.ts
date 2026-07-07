import { BadgeColor } from "../components/ui/badge/Badge";

export type OrderStatus =
  | "pending" | "processing" | "on-hold" | "completed"
  | "cancelled" | "refunded" | "failed" | "checkout-draft"
  | "waiting-transfer" | "pending-payment-1" | "pending-payment-2"
  | "wait-verify-1" | "wait-verify-2" | "paid-1" | "paid-2"
  | string;

export interface OrderStatusDetail {
  color: BadgeColor;
  text: string;
}

export const STATUS_PROGRESS_COLOR: Record<BadgeColor, string> = {
  primary: "bg-brand-500",
  success: "bg-success-500",
  error:   "bg-error-500",
  warning: "bg-warning-500",
  info:    "bg-blue-light-500",
  light:   "bg-gray-400",
  dark:    "bg-gray-700",
  amber:   "bg-amber-500",
  emerald: "bg-emerald-500",
};

export const STATUS_PROGRESS: Record<string, number> = {
  "waiting-transfer": 5,
  "pending-payment-1": 15, "wait-verify-1": 25, "paid-1": 40,
  "pending-payment-2": 50, "wait-verify-2": 65, "paid-2": 80,
  "packed": 90, "shipped": 95, "completed": 100,
};

export const ORDER_STATUS_DETAILS: Record<string, OrderStatusDetail> = {
  "pending":             { color: "primary", text: "Pending payment" },
  "processing":          { color: "warning", text: "Processing" },
  "on-hold":             { color: "dark",    text: "On hold" },
  "completed":           { color: "success", text: "Completed" },
  "cancelled":           { color: "light",   text: "Cancelled" },
  "refunded":            { color: "light",   text: "Refunded" },
  "failed":              { color: "error",   text: "Failed" },
  "checkout-draft":      { color: "light",   text: "Draft" },
  "waiting-transfer":    { color: "warning", text: "Waiting Transfer" },
  "pending-payment-1":   { color: "amber",   text: "Pending payment 1" },
  "pending-payment-2":   { color: "warning", text: "Pending payment 2" },
  "wait-verify-1":       { color: "amber",   text: "Waiting for Verification 1" },
  "wait-verify-2":       { color: "warning", text: "Waiting for Verification 2" },
  "paid-1":              { color: "primary", text: "Paid 1" },
  "paid-2":              { color: "emerald", text: "Paid 2" },
};
