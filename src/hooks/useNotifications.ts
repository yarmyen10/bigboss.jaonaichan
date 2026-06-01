import { useCallback, useEffect, useRef, useState } from "react";
import { getOrders } from "../services/jaonaichan";
import { ORDER_STATUS_DETAILS } from "../config/orderStatus.jaonaichan";

const STATUS_KEY = "bb_notif_status"; // Record<string, string> — orderId → last known status
const ITEMS_KEY  = "bb_notif_items";
const POLL_INTERVAL    = 30_000;
const NEW_ORDER_RECENT_MS = 5 * 60 * 1000; // browser push only for pending < 5 min
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface NotificationItem {
  orderId: number;
  orderNumber: string;
  status: string;
  statusText: string;
  customerName: string;
  total: number;
  detectedAt: number;
  read: boolean;
}

// --- localStorage helpers ---

function loadKnownStatuses(): Map<number, string> {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>;
      return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
    }
  } catch { /* ignore */ }
  return new Map();
}

function saveKnownStatuses(m: Map<number, string>) {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(Object.fromEntries(m)));
  } catch { /* ignore */ }
}

function loadItems(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationItem[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed
      .filter(i => i.detectedAt > cutoff)
      .map(i => ({ ...i, read: true }));
  } catch { /* ignore */ }
  return [];
}

function saveItems(items: NotificationItem[]) {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// --- browser Notification ---

async function requestNotifPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function notifTitle(status: string, orderNumber: string, isNew: boolean): string {
  if (status === "pending" && isNew) return `ออเดอร์ใหม่ — #${orderNumber}`;
  return `อัปเดตสถานะ — #${orderNumber}`;
}

function fireNotification(item: NotificationItem, isNew: boolean) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  new Notification(notifTitle(item.status, item.orderNumber, isNew), {
    body: `${item.customerName} · ${item.statusText}`,
    icon: "/favicon.ico",
    tag: `order-${item.orderId}`,
  });
}

// --- hook ---

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>(loadItems);
  const knownStatusesRef = useRef<Map<number, string>>(loadKnownStatuses());

  const poll = useCallback(async () => {
    try {
      const now = new Date();
      const [activeRes, pendingRes] = await Promise.all([
        getOrders({ status: "waiting-transfer,pending-payment-1,pending-payment-2,wait-verify-1,wait-verify-2", perPage: 50 }),
        getOrders({ status: "pending", createDateM: now.getMonth() + 1, createDateY: now.getFullYear(), perPage: 100 }),
      ]);

      const changedItems: NotificationItem[] = [];
      let anyChange = false;
      const thisMonth = now.getMonth();
      const thisYear  = now.getFullYear();

      for (const order of [...pendingRes.data, ...activeRes.data]) {
        const lastStatus = knownStatusesRef.current.get(order.id);
        if (lastStatus === order.status) continue; // unchanged — skip

        knownStatusesRef.current.set(order.id, order.status);
        anyChange = true;

        const isNew = lastStatus === undefined;
        const isStatusChange = !isNew;
        const age = Date.now() - new Date(order.date).getTime();
        const isRecent = age <= NEW_ORDER_RECENT_MS;

        // For non-pending isNew orders: only add to panel if modified this month
        if (isNew && order.status !== "pending") {
          const modified = order.date_modified ? new Date(order.date_modified) : null;
          const isThisMonth = modified && modified.getMonth() === thisMonth && modified.getFullYear() === thisYear;
          if (!isThisMonth) continue; // silently track in knownStatuses but skip the panel
        }

        const item: NotificationItem = {
          orderId:     order.id,
          orderNumber: order.number,
          status:      order.status,
          statusText:  ORDER_STATUS_DETAILS[order.status]?.text ?? order.status,
          customerName: order.customer.name,
          total:       order.total,
          detectedAt:  Date.now(),
          read: isNew && !(order.status === "pending" && isRecent),
        };
        changedItems.push(item);

        if (isNew && order.status === "pending" && isRecent) {
          fireNotification(item, true);
        } else if (isStatusChange) {
          fireNotification(item, false);
        }
      }

      if (anyChange) saveKnownStatuses(knownStatusesRef.current);

      if (changedItems.length > 0) {
        setItems(prev => {
          // Remove stale entries for orders whose status just changed
          const updatedIds = new Set(changedItems.map(i => i.orderId));
          const kept = prev.filter(i => !updatedIds.has(i.orderId));
          // Unread (status changes + new recent orders) → top
          // Read (startup load of pending history) → bottom
          const unread = changedItems.filter(i => !i.read);
          const read   = changedItems.filter(i =>  i.read);
          const next = [...unread, ...kept, ...read];
          saveItems(next);
          return next;
        });
      }
    } catch { /* silent — polling must not crash the app */ }
  }, []);

  useEffect(() => {
    requestNotifPermission();
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  const markAllRead = useCallback(() => {
    setItems(prev => {
      const next = prev.map(i => ({ ...i, read: true }));
      saveItems(next);
      return next;
    });
  }, []);

  const dismiss = useCallback((orderId: number) => {
    setItems(prev => {
      const next = prev.filter(i => i.orderId !== orderId);
      saveItems(next);
      return next;
    });
    // knownStatuses ยังเก็บ orderId ไว้ — ถ้า status เปลี่ยนอีก จะ notify ใหม่
  }, []);

  const unreadCount = items.filter(i => !i.read).length;

  return { items, unreadCount, markAllRead, dismiss };
}
