import { Sheet } from "react-modal-sheet";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * "peek" — opens showing only the handle bar; user swipes up to reveal content.
   * "default" — opens at full height immediately.
   */
  defaultSnap?: "peek" | "default";
  /** Sheet height at the default snap point as a CSS vh string, e.g. "70vh". */
  height?: string;
  /** Visible strip height in peek state, e.g. "52px". */
  peekHeight?: string;
  /**
   * Applied to the Sheet root — use for responsive gating, e.g. "min-[1025px]:hidden".
   * The Sheet root is the portalled element so this hides backdrop + panel together.
   */
  className?: string;
  /** Extra className for the sheet panel only. */
  sheetClassName?: string;
}

/** "70vh" → 0.7  |  "52px" → 52  |  fallback to provided default */
function parseSnapValue(s: string, fallback: number): number {
  const vh = s.match(/^(\d+(?:\.\d+)?)vh$/);
  if (vh) return parseFloat(vh[1]) / 100;
  const px = s.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) return parseFloat(px[1]);
  return fallback;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  defaultSnap = "default",
  height = "75vh",
  peekHeight = "52px",
  className = "",
  sheetClassName = "",
}: BottomSheetProps) {
  const defaultFraction = parseSnapValue(height, 0.75);
  const peekPx = parseSnapValue(peekHeight, 52);

  // Ascending order — library auto-prepends 0 (closed) and appends 1 (full):
  //   [0, peekPx, defaultFraction, 1]
  // indices: 0=closed, 1=peek, 2=default, 3=full
  const snapPoints = [peekPx, defaultFraction];
  const initialSnap = defaultSnap === "peek" ? 1 : 2;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnap={initialSnap}
      className={className}
      // Sheet root defaults to z-9999; modal uses z-99999 — must exceed it
      style={{ zIndex: 100000 }}
    >
      <Sheet.Container className={sheetClassName}>
        <Sheet.Header />
        <Sheet.Content>{children}</Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
