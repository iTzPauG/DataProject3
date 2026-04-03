import React from 'react';

// ─── Ref API exposed by both native and web BottomSheet ───────────────────────

export interface BottomSheetRef {
  /** Snap to a specific index (0 = collapsed, 1 = mid, 2 = expanded) */
  snapToIndex: (index: number) => void;
  /** Scroll the inner list to approximately cardIndex * cardHeight */
  scrollToIndex: (cardIndex: number, cardHeight?: number) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BottomSheetProps {
  /**
   * Height snap points expressed as percentage strings, ascending order:
   *   ['18%', '50%', '92%']  →  18 % visible (collapsed) … 92 % (expanded)
   */
  snapPoints: string[];
  /** Which snap point to start at (0-based). Defaults to 1 (mid). */
  initialSnapIndex?: number;
  /** Fixed header rendered above the scrollable list (drag handle goes above it). */
  header?: React.ReactNode;
  /** Scrollable list content. */
  children: React.ReactNode;
}
