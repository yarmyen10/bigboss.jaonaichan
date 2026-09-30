import { ReactNode } from "react";

// Opt-in structure for <Modal> content: header (fixed) → body (scrolls) → footer (pinned).
// Existing modals are untouched; use these for new/edited ones. Rules: vault Decisions/2026-09-30-ui-layout-rules.md
//
//   <Modal className="max-w-2xl m-4 w-full">
//     <ModalPanel>
//       <ModalHeader>…title…</ModalHeader>
//       <ModalBody>…content…</ModalBody>
//       <ModalFooter>…actions…</ModalFooter>
//     </ModalPanel>
//   </Modal>
//
// Spacing follows the rules: p-4 on mobile, sm:p-6 above. The header keeps room on the right for <Modal>'s ✕ button.

interface SectionProps {
  children: ReactNode;
  className?: string;
}

// max-h keeps the panel inside the viewport (m-4 on <Modal> = 2rem) so only the body scrolls; dvh follows mobile browser bars
export const ModalPanel = ({ children, className = "" }: SectionProps) => (
  <div className={`flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl ${className}`}>{children}</div>
);

export const ModalHeader = ({ children, className = "" }: SectionProps) => (
  <div className={`shrink-0 border-b border-gray-100 px-4 py-4 pr-14 dark:border-white/[0.05] sm:px-6 sm:pr-20 ${className}`}>{children}</div>
);

export const ModalBody = ({ children, className = "" }: SectionProps) => (
  <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${className}`}>{children}</div>
);

// on mobile give the buttons `flex-1 sm:flex-none` so they share the row; an error message may sit first (w-full on mobile)
export const ModalFooter = ({ children, className = "" }: SectionProps) => (
  <div className={`flex shrink-0 flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-4 dark:border-white/[0.05] dark:bg-transparent sm:justify-end sm:px-6 ${className}`}>{children}</div>
);
