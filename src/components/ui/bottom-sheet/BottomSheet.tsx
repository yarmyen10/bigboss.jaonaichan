import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Sheet height (CSS length). Defaults to "75vh". */
  height?: string;
  /** Distance (px) dragged past the handle threshold before close fires. */
  closeThreshold?: number;
  /** className applied to the outer portal root — use this to gate by media query (e.g. "min-[1025px]:hidden"). */
  className?: string;
  /** className applied to the sheet panel. */
  sheetClassName?: string;
  /** Render a drag handle at the top. Default true. */
  showHandle?: boolean;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  height = "75vh",
  closeThreshold = 120,
  className = "",
  sheetClassName = "",
  showHandle = true,
}: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setDragY(0);
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current == null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > closeThreshold) {
      onClose();
    }
    setDragY(0);
    setIsDragging(false);
    startYRef.current = null;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-end ${className}`}>
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl ${sheetClassName}`}
        style={{
          height,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 300ms ease",
        }}
      >
        {showHandle && (
          <div
            className="flex justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
