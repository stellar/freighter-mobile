import {
  buildSwapRouteView,
  selectSwapRoute,
  SwapRouteView,
} from "components/screens/SwapScreen/helpers";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { useProtocolsStore } from "ducks/protocols";
import { useSwapStore } from "ducks/swap";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import type { HeldBalanceItem } from "hooks/useBalancesList";
import { useEffect, useMemo, useState } from "react";
import { TokenListReponseItem } from "services/verified-token-lists/types";

/** The Route sheet's model for the quote on screen; null hides the Route row. */
export const useSwapRouteView = (
  balanceItems: HeldBalanceItem[],
  network: NETWORKS,
): SwapRouteView | null => {
  const { swapQuotes, destinationToken: destination } = useSwapStore();
  const { protocols } = useProtocolsStore();
  const { readCache } = useVerifiedTokensStore();
  const [tokenLists, setTokenLists] = useState<TokenListReponseItem[]>([]);

  // The swap picker fills this cache; reading it costs no request.
  useEffect(() => {
    let isCurrent = true;
    readCache(network)
      .then((cached) => {
        if (isCurrent) setTokenLists(cached?.data ?? []);
      })
      .catch(() => {
        if (isCurrent) setTokenLists([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [readCache, network]);

  return useMemo(
    () =>
      buildSwapRouteView({
        route: swapQuotes ? selectSwapRoute(swapQuotes) : null,
        protocols,
        balanceItems,
        destination,
        tokenLists,
        networkPassphrase:
          mapNetworkToNetworkDetails(network).networkPassphrase,
      }),
    [swapQuotes, protocols, balanceItems, destination, tokenLists, network],
  );
};
