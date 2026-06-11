import { computeTrendingIntersection } from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { useBlockaidTokenScansStore } from "ducks/blockaidTokenScans";
import { useStellarExpertTopTokensStore } from "ducks/stellarExpertTopTokens";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { useEffect } from "react";
import { InteractionManager } from "react-native";

/**
 * Pre-warms the three caches that feed both swap-token lists:
 *   - SwapAmountScreen's "Trending Tokens" list
 *   - SwapToScreen's "Popular tokens" section in the picker
 *
 * Deferred via InteractionManager so it doesn't compete with critical-
 * path requests on TabNavigator mount. If the user opens Swap before
 * this pre-warm completes, the screen's pipeline may fire duplicate
 * requests — the underlying caches absorb them on the second pass
 * (each subsequent fetch sees the data the first one wrote). The cost
 * is at most one extra round-trip per layer during the narrow window
 * between TabNavigator mount and Swap open.
 *
 * Gates the Blockaid scan on both upstream fetches succeeding so we
 * don't issue a scan with an empty intersection or with no verified
 * filter applied.
 */
export const useSwapTokenListsPrewarm = (network: NETWORKS): void => {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      const [topResp, verSplit] = await Promise.all([
        useStellarExpertTopTokensStore
          .getState()
          .getStellarExpertTopTokens({ network }),
        useVerifiedTokensStore.getState().getVerifiedTokens({ network }),
      ]);
      // Either fetch failed → intersection would be empty → no Blockaid work.
      if (!topResp || !verSplit) return;

      // The trustline callback is irrelevant for the pre-warm — Blockaid
      // scans are keyed on (tokenCode, issuer), not on whether the user
      // holds the token. Pass a constant false to avoid coupling to
      // balance items here.
      const intersection = computeTrendingIntersection(
        topResp,
        verSplit,
        () => false,
      );
      const addressList = intersection
        .filter((t) => t.issuer)
        .map((t) => `${t.tokenCode}-${t.issuer}`);
      if (addressList.length === 0) return;

      await useBlockaidTokenScansStore
        .getState()
        .scanBulkWithCache({ addressList, network });
    });
    return () => task.cancel();
  }, [network]);
};
