import {
  buildSwapRouteView,
  selectSwapRoute,
  SwapRouteView,
} from "components/screens/SwapScreen/helpers";
import { useProtocolsStore } from "ducks/protocols";
import { useSwapStore } from "ducks/swap";
import type { HeldBalanceItem } from "hooks/useBalancesList";
import { useMemo } from "react";

/** The Route sheet's model for the quote on screen; null hides the Route row. */
export const useSwapRouteView = (
  balanceItems: HeldBalanceItem[],
): SwapRouteView | null => {
  const { swapQuotes, destinationToken: destination } = useSwapStore();
  const { protocols } = useProtocolsStore();

  return useMemo(
    () =>
      buildSwapRouteView({
        route: swapQuotes ? selectSwapRoute(swapQuotes) : null,
        protocols,
        balanceItems,
        destination,
      }),
    [swapQuotes, protocols, balanceItems, destination],
  );
};
