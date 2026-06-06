import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Icon from "components/sds/Icon";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useCallback, useRef } from "react";

/**
 * Owns the SwapAmountScreen's transaction-settings sheet:
 *
 *   - The sheet's BottomSheetModal ref — returned so the JSX still
 *     mounts the actual `<TransactionSettingsBottomSheet modalRef={...}>`
 *     in the same React tree as `present()` is called from.
 *   - `openSettings` — opens the sheet. Wired into the right-header
 *     gear button automatically (via useRightHeaderButton) AND
 *     returned for the footer's "Settings" button to consume.
 *   - `confirmSettings` / `cancelSettings` — both call dismiss(); kept
 *     as separate handlers so the bottom-sheet's typed prop signatures
 *     (`onConfirm`, `onCancel`) bind cleanly without ad-hoc wrappers.
 *
 * `onSettingsChange` (rebuilding the swap when fee / slippage / timeout
 * changes) is intentionally NOT owned here — it depends on the
 * screen-level prepareSwapTransaction and stays inline with the rest
 * of the path-finding wiring.
 */
export const useSwapTransactionSettings = (): {
  transactionSettingsBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  openSettings: () => void;
  confirmSettings: () => void;
  cancelSettings: () => void;
} => {
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const openSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.present();
  }, []);

  const confirmSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  }, []);

  const cancelSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  }, []);

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: openSettings,
  });

  return {
    transactionSettingsBottomSheetModalRef,
    openSettings,
    confirmSettings,
    cancelSettings,
  };
};
