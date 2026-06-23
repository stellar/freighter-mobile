import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import Icon from "components/sds/Icon";
import { useSwapSettingsStore } from "ducks/swapSettings";
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
 *
 * `recommendedFee` / `operationCount` are taken so `openSettings` can settle
 * the op-count-scaled recommended total into the store *before* presenting the
 * sheet. The sheet otherwise re-scales the fee (`recommendedFee × ops`) in a
 * post-mount effect, so the displayed value would visibly jump — e.g. from the
 * 1-op total to the 2-op total the instant the destination became a new token
 * needing a trustline op.
 */
export const useSwapTransactionSettings = ({
  recommendedFee,
  operationCount,
}: {
  recommendedFee: string;
  operationCount: number;
}): {
  transactionSettingsBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  openSettings: () => void;
  confirmSettings: () => void;
  cancelSettings: () => void;
} => {
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { swapFee, feeManuallyChanged, saveSwapFee } = useSwapSettingsStore();

  const openSettings = useCallback(() => {
    // Pre-settle the fee so the sheet's first render already shows the final
    // value (no post-mount jump). Skip when the user set the fee manually —
    // their total is preserved and split per op at build time.
    if (!feeManuallyChanged && recommendedFee) {
      const scaledTotal = new BigNumber(recommendedFee).times(operationCount);
      // Compare numerically (not by string) so a differently-formatted but
      // equal stored value doesn't trigger a redundant write.
      if (!scaledTotal.eq(swapFee)) {
        saveSwapFee(scaledTotal.toString());
      }
    }
    transactionSettingsBottomSheetModalRef.current?.present();
  }, [
    feeManuallyChanged,
    recommendedFee,
    operationCount,
    swapFee,
    saveSwapFee,
  ]);

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
