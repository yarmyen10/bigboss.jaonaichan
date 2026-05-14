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
