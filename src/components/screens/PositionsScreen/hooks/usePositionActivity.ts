import {
  ActivityHistoryOperation,
  PositionActivityItem,
  getBlendActivityFromHistory,
} from "components/screens/PositionsScreen/helpers/positionActivity";
import { NetworkDetails } from "config/constants";
import { useHistoryStore } from "ducks/history";
import { useMemo } from "react";

/**
 * One supplied token's activity in one pool, newest first.
 *
 * INTERIM, as in the extension: read from the History operations the app
 * already fetches and polls, so opening a position costs no request. Null
 * until that history has loaded. A backend activity endpoint would replace
 * only the source below; the items keep their shape.
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
