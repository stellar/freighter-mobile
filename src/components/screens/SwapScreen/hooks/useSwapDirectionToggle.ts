import { descriptorFromBalance } from "components/screens/SwapScreen/helpers";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { AnalyticsEvent } from "config/analyticsConfig";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useCallback } from "react";
import { analytics } from "services/analytics";

/**
 * Owns the chevron-toggle handler that swaps the Sell ↔ Receive sides on
 * SwapAmountScreen. Captures a pre-swap snapshot for the
 * SWAP_DIRECTION_TOGGLED analytics payload (source side reads from the
 * held balance, destination from the store descriptor so non-held
 * destinations are still represented), then re-wires the swap store:
 *
 * - Sell slot gets the previous destination's id+symbol IF that
 *   destination was held; otherwise clears so the chip shows "Select".
 * - Receive slot gets the previous source's descriptor IF source was
 *   held; otherwise clears.
 * - Both the store's `sourceAmount`/`sourceAmountDisplay` AND the
 *   converter's `tokenAmount` reset to "0" in the same React batch.
 *   Setting the store value directly (rather than relying on the
 *   converter→store mirror effect to catch up next render) is what
 *   prevents `useSwapAmountError` from firing an INSUFFICIENT_BALANCE
 *   toast for the OLD amount paired with the NEW source balance during
 *   the one-render window before the mirror runs.
 */
export const useSwapDirectionToggle = ({
  sourceBalance,
  destinationBalance,
  destinationTokenDescriptor,
  setSourceToken,
  setDestinationToken,
  setSourceAmount,
  setSourceAmountDisplay,
  setTokenAmount,
}: {
  sourceBalance: HeldBalanceItem | undefined;
  destinationBalance: HeldBalanceItem | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  setSourceToken: (id: string, symbol: string) => void;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
  setSourceAmount: (amount: string) => void;
  setSourceAmountDisplay: (amount: string) => void;
  setTokenAmount: (amount: string) => void;
}): { handleSwapDirection: () => void } => {
  const handleSwapDirection = useCallback(() => {
    const previousSourceIssuer = sourceBalance
      ? (descriptorFromBalance(sourceBalance).issuer ?? "")
      : "";
    const swapDirectionPayload = {
      previousSourceTokenCode: sourceBalance?.tokenCode ?? "",
      previousSourceTokenIssuer: previousSourceIssuer,
      previousDestinationTokenCode: destinationTokenDescriptor?.tokenCode ?? "",
      previousDestinationTokenIssuer: destinationTokenDescriptor?.issuer ?? "",
    };
    analytics.track(
      AnalyticsEvent.SWAP_DIRECTION_TOGGLED,
      swapDirectionPayload,
    );
    if (destinationBalance) {
      setSourceToken(
        destinationBalance.id,
        destinationBalance.tokenCode ?? destinationBalance.displayName ?? "",
      );
    } else {
      // Previous destination is non-held — clear sell so the chip renders
      // its "Select" empty state. The picker stays tappable.
      setSourceToken("", "");
    }
    if (sourceBalance) {
      setDestinationToken(descriptorFromBalance(sourceBalance));
    } else {
      setDestinationToken(null);
    }
    // Reset the store's amount fields in the SAME batch as the token
    // swap so useSwapAmountError sees (newSourceBalance, "0") together
    // rather than (newSourceBalance, oldAmount) for the one render
    // before the converter→store mirror catches up.
    setSourceAmount("0");
    setSourceAmountDisplay("0");
    setTokenAmount("0");
  }, [
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor?.tokenCode,
    destinationTokenDescriptor?.issuer,
    setSourceToken,
    setDestinationToken,
    setSourceAmount,
    setSourceAmountDisplay,
    setTokenAmount,
  ]);

  return { handleSwapDirection };
};
