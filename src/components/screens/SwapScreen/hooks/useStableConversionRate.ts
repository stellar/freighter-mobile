import { formatConversionRate } from "components/screens/SwapScreen/helpers";
import { SwapPathResult } from "ducks/swap";
import { calculateSwapRate } from "helpers/balances";
import { useEffect, useState } from "react";

/**
 * Sticky conversion-rate string for the swap review sheet.
 *
 * The path-finding pipeline briefly nulls out the conversion rate
 * (between path-finding cycles, e.g. when the user nudges the amount
 * and a new request is in flight). Without stickiness the review sheet
 * would flicker its rate line empty. We keep the last *valid* formatted
 * rate visible and only overwrite it when a positive numeric rate comes
 * through, so transient nulls don't reach the UI.
 *
 * The hook computes the current rate (path result first, derived
 * source/destination ratio second) internally and returns only the
 * sticky string for display.
 */
export const useStableConversionRate = ({
  pathResult,
  sourceTokenSymbol,
  destinationTokenSymbol,
}: {
  pathResult: SwapPathResult | null;
  sourceTokenSymbol: string;
  destinationTokenSymbol: string;
}): { stableConversionRate: string } => {
  const [stableConversionRate, setStableConversionRate] = useState<string>("");

  const currentConversionRate =
    pathResult?.conversionRate ||
    calculateSwapRate(
      Number(pathResult?.sourceAmount),
      Number(pathResult?.destinationAmount),
    );

  useEffect(() => {
    if (
      currentConversionRate &&
      !Number.isNaN(Number(currentConversionRate)) &&
      Number(currentConversionRate) > 0
    ) {
      setStableConversionRate(
        formatConversionRate({
          rate: currentConversionRate,
          sourceSymbol: sourceTokenSymbol,
          destinationSymbol: destinationTokenSymbol,
        }),
      );
    }
  }, [currentConversionRate, sourceTokenSymbol, destinationTokenSymbol]);

  return { stableConversionRate };
};
