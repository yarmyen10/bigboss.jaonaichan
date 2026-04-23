import { ReactNode, useState } from "react";
import { Dropdown } from "./Dropdown";

interface BulkActionsDropdownProps {
  label?: string;
  children: (close: () => void) => ReactNode;
}

export function BulkActionsDropdown({ label = "Actions", children }: BulkActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        className="dropdown-toggle inline-flex items-center gap-1.5 rounded-lg bg-orange-500/80 px-3 py-1.5 text-sm font-medium text-white ring ring-inset ring-gray-100 hover:bg-orange-600/80 dark:ring-gray-500 dark:text-gray-200"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Dropdown isOpen={open} onClose={close} className="w-52 py-2 left-0 right-auto">
        {children(close)}
      </Dropdown>
    </div>
  );
}

export function DropdownSectionHeader({ label, border = false }: { label: string; border?: boolean }) {
  return (
    <p className={`px-3 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500${border ? " mt-1 border-t border-gray-100 pt-2 dark:border-gray-800" : ""}`}>
      {label}
    </p>
  );
}
