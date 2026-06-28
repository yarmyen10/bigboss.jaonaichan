import { useState, useCallback } from "react";
import { Order as OrderIF } from "../../interfaces/order.jaonaichan";
import { useModal } from "../useModal";
import { patchOrderStatus, deleteSlip, deleteOrder } from "../../services/jaonaichan";

interface UseOrderModalsParams {
  withSpinner: (fn: () => Promise<void>) => void;
  onSaved: () => void; // Usually loadOrders(dateFilter)
}

export function useOrderModals({ withSpinner, onSaved }: UseOrderModalsParams) {
  // ── View Details Modal ──
  const [viewOrder, setViewOrder] = useState<OrderIF | null>(null);
  const { isOpen: isDetailsOpen, openModal: openDetails, closeModal: closeDetails } = useModal();

  const handleViewMore = useCallback((row: OrderIF) => {
    setViewOrder(row);
    openDetails();
  }, [openDetails]);

  // ── Update Status Modal ──
  const { isOpen: isUpdateStatusOpen, openModal: openUpdateStatus, closeModal: closeUpdateStatus } = useModal();
  const [updateStatusOrders, setUpdateStatusOrders] = useState<OrderIF[]>([]);
  const [newStatus, setNewStatus] = useState<string>("");
  const [removeSlip, setRemoveSlip] = useState(false);

  const handleOpenUpdateStatus = useCallback((orders: OrderIF[]) => {
    setUpdateStatusOrders(orders);
    setNewStatus("");
    setRemoveSlip(false);
    openUpdateStatus();
  }, [openUpdateStatus]);

  const handleConfirmUpdateStatus = () => {
    if (!newStatus) return;
    withSpinner(async () => {
      await Promise.all(
        updateStatusOrders.map(async (order) => {
          await patchOrderStatus(order.id, `wc-${newStatus}`);
          if (removeSlip) {
            await Promise.allSettled([
              deleteSlip(order.id, 1),
              deleteSlip(order.id, 2),
            ]);
          }
        })
      );
      closeUpdateStatus();
      onSaved();
    });
  };

  // ── Delete Orders Modal ──
  const { isOpen: isDeleteOpen, openModal: openDelete, closeModal: closeDelete } = useModal();
  const [deleteTargetOrders, setDeleteTargetOrders] = useState<OrderIF[]>([]);

  const handleOpenDelete = useCallback((orders: OrderIF[]) => {
    setDeleteTargetOrders(orders);
    openDelete();
  }, [openDelete]);

  const handleConfirmDelete = () => {
    withSpinner(async () => {
      try {
        await Promise.all(
          deleteTargetOrders.map(async (order) => {
            await Promise.allSettled([
              deleteSlip(order.id, 1),
              deleteSlip(order.id, 2),
            ]);
            const res = await deleteOrder(order.id) as any;
            if (res && res.error) {
              throw new Error(res.error);
            }
          })
        );
        closeDelete();
        onSaved();
      } catch (error: any) {
        console.error("Delete order failed", error);
        alert("Failed to delete order: " + (error.message || "Unknown error"));
      }
    });
  };

  return {
    viewOrder,
    setViewOrder,
    isDetailsOpen,
    openDetails,
    closeDetails,
    handleViewMore,

    isUpdateStatusOpen,
    closeUpdateStatus,
    updateStatusOrders,
    newStatus,
    setNewStatus,
    removeSlip,
    setRemoveSlip,
    handleOpenUpdateStatus,
    handleConfirmUpdateStatus,

    isDeleteOpen,
    closeDelete,
    deleteTargetOrders,
    handleOpenDelete,
    handleConfirmDelete,
  };
}
