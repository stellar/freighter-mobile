import BigNumber from "bignumber.js";
import { projectEarnings } from "components/screens/EarnScreen/helpers/projectEarnings";
import {
  getSupplyRowIdentity,
  toDisplayTokens,
} from "components/screens/PositionsScreen/helpers/positionRows";
import { BlendPoolPosition, BlendSupplyPosition } from "config/blendTypes";
import { NetworkDetails } from "config/constants";

export interface PoolPositionSummary {
  /** The pool's total value to this account. Null when unpriced. */
  totalUsd: number | null;
  /**
   * Lifetime interest across every supplied token. Null if ANY row is
   * unpriced: a partial sum would understate the figure while looking whole.
   */
  interestUsd: number | null;
  /** Interest as a share of principal (0.0254 = 2.54%). Null when underivable. */
  gainPercent: number | null;
  /** The pool's rate for this account, as the backend reports it. */
  apy: number | null;
}

/**
 * Interest as a share of principal (total minus interest). Null when either
 * figure is unknown. A position that is all accrued interest has no principal
 * to measure against, so the share is null there too, not infinite.
 */
export const getGainPercent = (
  totalUsd: number | null,
  interestUsd: number | null,
): number | null => {
  if (totalUsd === null || interestUsd === null) {
    return null;
  }
  const principal = new BigNumber(totalUsd).minus(interestUsd);
  if (principal.lte(0)) {
    return null;
  }
  return new BigNumber(interestUsd).dividedBy(principal).toNumber();
};

/**
 * A pool card's and the pool position screen's figures.
 *
 * The total is the SUPPLIED side, not net of borrows: the screen lists the
 * supplied tokens only, and a header netted against a borrow would disagree
 * with its own list. The net figure stands in only while the supplied one is
 * unpriced. The gain is measured against principal, as on the token screen.
 */
export const getPoolPositionSummary = (
  position: BlendPoolPosition,
): PoolPositionSummary => {
  const totalUsd = position.suppliedUsd ?? position.netUsd ?? null;

  // A pool with no detail has UNKNOWN interest, not zero. Within a list, one
  // unpriced row makes the whole sum unknown rather than partial.
  const interestUsd =
    position.supply === null
      ? null
      : position.supply.reduce<number | null>((sum, row) => {
          if (sum === null || row.interestEarnedUsd === null) {
            return null;
          }
          return sum + row.interestEarnedUsd;
        }, 0);

  return {
    totalUsd,
    interestUsd,
    gainPercent: getGainPercent(totalUsd, interestUsd),
    apy: position.netApy,
  };
};

/** A token amount on the token position screen, in display units and USD. */
export interface PositionAssetFigures {
  /** Display units; null when the token's scale is unknown. */
  tokens: string | null;
  usd: number | null;
}

export interface PositionSummary {
  currentBalanceUsd: number | null;
  /** Supply interest rate, without BLND emissions. */
  apy: number | null;
  /** Null when the pool holds none of the token. */
  deposits: PositionAssetFigures | null;
  earnings: PositionAssetFigures | null;
  /** To 2 decimals, or null when the rate or the balance is unknown. */
  estMonthlyUsd: string | null;
  estYearlyUsd: string | null;
}

/**
 * Deposits mean PRINCIPAL, not the current total. `totalTokens` already
 * carries the accrued interest the earnings card reports, so counting it in
 * both would show the same interest twice. The payload has no principal, so
 * it is the balance less the interest.
 *
 * The interest is lifetime, though: it survives a full exit, so after a
 * withdrawal it can exceed what's left. That is a real payload state, so it
 * reads as no principal ("0" tokens, unknown USD) rather than a negative one.
 */
const toDepositFigures = (
  row: BlendSupplyPosition,
  decimals: number | null,
): PositionAssetFigures => {
  const totalTokens = new BigNumber(row.totalTokens);
  const interestEarned = new BigNumber(row.interestEarned);
  const isOutOfRange =
    interestEarned.isGreaterThan(totalTokens) ||
    (row.usdValue !== null &&
      row.interestEarnedUsd !== null &&
      row.interestEarnedUsd > row.usdValue);

  return {
    tokens: isOutOfRange
      ? "0"
      : toDisplayTokens(totalTokens.minus(interestEarned).toFixed(0), decimals),
    usd:
      isOutOfRange || row.usdValue === null || row.interestEarnedUsd === null
        ? null
        : new BigNumber(row.usdValue).minus(row.interestEarnedUsd).toNumber(),
  };
};

/**
 * A token position screen's "Your position" figures, for one supplied token.
 * Pool-wide totals are `getPoolPositionSummary`'s; this never aggregates.
 */
export const getPositionSummary = ({
  position,
  focusedAssetId,
  networkDetails,
}: {
  position: BlendPoolPosition;
  focusedAssetId: string;
  networkDetails: NetworkDetails;
}): PositionSummary => {
  const row = (position.supply || []).find(
    (supply) => supply.assetId === focusedAssetId,
  );

  if (!row) {
    return {
      currentBalanceUsd: null,
      apy: null,
      deposits: null,
      earnings: null,
      estMonthlyUsd: null,
      estYearlyUsd: null,
    };
  }

  const { decimals } = getSupplyRowIdentity(row, networkDetails);

  // Projected on the whole balance, not the principal: Blend accrues interest
  // into the supplied balance itself, so interest already earned earns too.
  const { monthly, yearly } = projectEarnings({
    depositUsd:
      row.usdValue === null ? null : new BigNumber(row.usdValue).toFixed(),
    // Interest only: BLND emissions are left out, as everywhere in Earn.
    apy: row.apy,
  });

  return {
    currentBalanceUsd: row.usdValue,
    apy: row.apy,
    deposits: toDepositFigures(row, decimals),
    earnings: {
      tokens: toDisplayTokens(row.interestEarned, decimals),
      usd: row.interestEarnedUsd,
    },
    estMonthlyUsd: monthly,
    estYearlyUsd: yearly,
  };
};
