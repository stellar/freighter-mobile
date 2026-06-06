import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { SwapReviewFooter } from "components/screens/SwapScreen/components";
import React, { useCallback, useMemo } from "react";

/**
 * Owns the SwapAmountScreen's review-footer view-model:
 *
 *   - `handleCancelSwap` — dismisses the review bottom sheet (kept
 *     internal; the hook returns the resulting renderer, not this
 *     callback, so consumers never wire it manually).
 *   - `footerProps` — the memoised prop bag SwapReviewFooter needs
 *     (cancel, confirm, isBuilding, isMalicious, isSuspicious,
 *     transactionXDR, onSettingsPress).
 *   - `renderFooterComponent` — the no-arg renderer the screen passes
 *     to `BaseLayout.scrollViewFooterComponent`.
 *
 * Returning the renderer (not the prop bag) keeps the footer's
 * SwapReviewFooter import out of the screen file once the screen no
 * longer uses it directly.
 */
export const useSwapFooter = ({
  swapReviewBottomSheetModalRef,
  onConfirm,
  isBuilding,
  isMalicious,
  isSuspicious,
  transactionXDR,
  onSettingsPress,
}: {
  swapReviewBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  onConfirm: () => void;
  isBuilding: boolean;
  isMalicious: boolean;
  isSuspicious: boolean;
  transactionXDR: string | undefined | null;
  onSettingsPress: () => void;
}): { renderFooterComponent: () => React.JSX.Element } => {
  const handleCancelSwap = useCallback(() => {
    swapReviewBottomSheetModalRef.current?.dismiss();
  }, [swapReviewBottomSheetModalRef]);

  const footerProps = useMemo(
    () => ({
      onCancel: handleCancelSwap,
      onConfirm,
      isBuilding,
      isMalicious,
      isSuspicious,
      transactionXDR: transactionXDR ?? undefined,
      onSettingsPress,
    }),
    [
      handleCancelSwap,
      onConfirm,
      isBuilding,
      isMalicious,
      isSuspicious,
      transactionXDR,
      onSettingsPress,
    ],
  );

  const renderFooterComponent = useCallback(
    () => <SwapReviewFooter {...footerProps} />,
    [footerProps],
  );

  return { renderFooterComponent };
};
