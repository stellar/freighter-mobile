import { NetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { useEarnStore } from "ducks/earn";
import { useEffect } from "react";
import { getBlendSuppliedTokens } from "services/blend";

export interface UseEarnPositionParams {
  poolId: string;
  assetId: string;
  publicKey: string;
  networkDetails: NetworkDetails;
}

export interface UseEarnPositionResult {
  /** Raw integer string, in the asset's own base units — the "before" side
   * of Review's before -> after row. */
  currentPositionTokens: string;
}

/**
 * Fetches the account's existing Blend position for (poolId, assetId) and
 * writes it to the earn duck as the "before" value Review reads for its
 * before -> after row.
 *
 * A no-op until every input has resolved (e.g. before `pool` has loaded on
 * the token picker), since `getBlendSuppliedTokens` cannot answer without
 * all four.
 *
 * A failed fetch is deliberately non-fatal: it is logged and swallowed,
 * leaving `currentPositionTokens` at whatever the duck already held (its "0"
 * default on a fresh flow) rather than blocking the deposit. A stale or
 * missing before-value must never gate Review — that is explicit in the
 * spec, since the "after" value alone is still a usable review.
 */
export const useEarnPosition = ({
  poolId,
  assetId,
  publicKey,
  networkDetails,
}: UseEarnPositionParams): UseEarnPositionResult => {
  const currentPositionTokens = useEarnStore(
    (state) => state.currentPositionTokens,
  );
  const setCurrentPositionTokens = useEarnStore(
    (state) => state.setCurrentPositionTokens,
  );

  useEffect(() => {
    if (!poolId || !assetId || !publicKey) {
      return undefined;
    }

    // Guards against a slow/late response landing after a newer request has
    // superseded it (e.g. the user backed out and re-entered with a
    // different asset) — the same "only the latest write wins" shape used by
    // `transactionBuilder`'s requestId guard, minus the store field, since
    // an unmount is enough of a signal here.
    let isCancelled = false;

    (async () => {
      try {
        const tokens = await getBlendSuppliedTokens({
          publicKey,
          poolId,
          assetId,
          networkDetails,
        });

        if (!isCancelled) {
          setCurrentPositionTokens(tokens);
        }
      } catch (err) {
        // Non-fatal by design: Review renders the "after" value alone rather
        // than blocking the deposit on an unavailable before-value.
        logger.error("useEarnPosition", "Failed to fetch Blend position", err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [poolId, assetId, publicKey, networkDetails, setCurrentPositionTokens]);

  return { currentPositionTokens };
};
