import BigNumber from "bignumber.js";
import { getSupplyRowIdentity } from "components/screens/PositionsScreen/helpers/positionRows";
import { BlendPoolPosition } from "config/blendTypes";
import { NETWORKS, NetworkDetails } from "config/constants";

/** How long Home waits for a deposit to show in Positions before giving up. */
export const AWAITED_DEPOSIT_MS = 30_000;

/** How often Home re-reads Positions while it waits. */
export const AWAITED_DEPOSIT_POLL_MS = 3_000;

/** A deposit that just landed, which the positions indexer may not show yet. */
export interface AwaitedDeposit {
  publicKey: string;
  network: NETWORKS;
  poolId: string;
  assetId: string;
  /**
   * In display units: the row's balance before the deposit plus half the
   * amount deposited. Half, so a little interest or a rounded figure can't
   * keep the wait from ending.
   */
  minTokens: string;
  /** Epoch ms after which Home stops waiting. */
  expiresAt: number;
}

/**
 * Whether these positions already include the awaited deposit: the deposited
 * token holds at least the amount the deposit should have brought it to. A
 * token whose scale is unknown can't be measured, so the wait carries on
 * until it expires; every read along the way still updates Positions.
 */
export const hasDepositLanded = (
  positions: BlendPoolPosition[],
  awaited: AwaitedDeposit,
  networkDetails: NetworkDetails,
): boolean => {
  const row = positions
    .find((position) => position.poolId === awaited.poolId)
    ?.supply?.find((supply) => supply.assetId === awaited.assetId);
  if (!row) {
    return false;
  }

  const { decimals } = getSupplyRowIdentity(row, networkDetails);
  if (decimals === null) {
    return false;
  }
  return new BigNumber(row.totalTokens)
    .shiftedBy(-decimals)
    .gte(awaited.minTokens);
};
