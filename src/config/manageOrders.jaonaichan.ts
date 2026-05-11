import { TabOption } from '../components/ui/tabs';

export type ManageAction = 'bill2';

/** Which actions are available for each order status (union across selected orders). */
export const STATUS_MANAGE_ACTIONS: Record<string, ManageAction[]> = {
    'paid-1': ['bill2'],
};

type TabTemplate = { value: string; label: string; color?: string };

/** Tab template for each manage action (count is injected at runtime). */
export const MANAGE_ACTION_TAB: Record<ManageAction, TabTemplate> = {
    bill2: { value: 'bill2', label: 'Bill No. 2', color: 'warning' },
};

/** Returns true if at least one order in the selection has a manageable status. */
export function hasManageableOrders(statuses: string[]): boolean {
    return statuses.some(s => (STATUS_MANAGE_ACTIONS[s]?.length ?? 0) > 0);
}

/**
 * Compute which manage tabs should appear given the selected orders.
 * Uses union: a tab appears if ANY selected order's status allows it.
 * Each tab's count reflects only the orders whose status supports that action.
 */
export function resolveManageTabs(orders: { status: string }[]): TabOption[] {
    const allowed = new Set<ManageAction>();
    const counts = new Map<ManageAction, number>();

    for (const order of orders) {
        for (const action of STATUS_MANAGE_ACTIONS[order.status] ?? []) {
            allowed.add(action);
            counts.set(action, (counts.get(action) ?? 0) + 1);
        }
    }

    return [...allowed].map(action => ({ ...MANAGE_ACTION_TAB[action], count: counts.get(action) ?? 0 }));
}
