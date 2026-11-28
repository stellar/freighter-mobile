import {
  ActivityHistoryOperation,
  PositionActivityItem,
  getBlendActivityFromHistory,
} from "components/screens/PositionsScreen/helpers/positionActivity";
import { NetworkDetails } from "config/constants";
import { useHistoryStore } from "ducks/history";
import { useEffect, useMemo } from "react";

/**
 * One supplied token's activity in one pool, newest first.
 *
 * INTERIM, as in the extension: read from the History operations the app
 * already fetches and polls, so opening a position usually costs no request.
 * History's first poll comes 30 seconds after launch, though, and switching
 * accounts clears it, so a position opened before then loads it, in the
 * background as a poll does. Null until it has loaded. A backend activity
 * endpoint would replace only the source below; the items keep their shape.
 */
export const usePositionActivity = ({
  poolId,
  assetId,
  publicKey,
  networkDetails,
}: {
  poolId: string;
  assetId: string;
  publicKey: string;
  networkDetails: NetworkDetails;
}): PositionActivityItem[] | null => {
  const operations = useHistoryStore(
    (state) => state.rawHistoryData?.rawOperations,
  );
  const fetchAccountHistory = useHistoryStore(
    (state) => state.fetchAccountHistory,
  );
  const hasHistory = !!operations;

  useEffect(() => {
    if (hasHistory || !publicKey) {
      return;
    }
    // The store skips a fetch while another is in flight.
    fetchAccountHistory({
      publicKey,
      network: networkDetails.network,
      isBackgroundRefresh: true,
    }).catch(() => {
      // The store reports its own failures.
    });
  }, [hasHistory, publicKey, networkDetails.network, fetchAccountHistory]);

  return useMemo(() => {
    if (!operations || !publicKey) {
      return null;
    }
    return getBlendActivityFromHistory({
      // Horizon's typing leaves out the fields the backend joins in.
      operations: operations as unknown as ActivityHistoryOperation[],
      poolId,
      publicKey,
      networkDetails,
    }).filter((item) => item.assetId === assetId);
  }, [operations, poolId, assetId, publicKey, networkDetails]);
};
