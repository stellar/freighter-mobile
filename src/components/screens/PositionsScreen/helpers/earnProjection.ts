import BigNumber from "bignumber.js";
import { BlendEarnAssetOption } from "config/blendTypes";
import { NetworkDetails } from "config/constants";
import { PricedBalanceMap } from "config/types";
import { getBalanceByContractId } from "helpers/balances";
import { getBalanceInWholeUnits } from "helpers/formatAmount";

/**
 * One catalog option's rate: its best pool's supply APY, interest only (BLND
 * emissions are left out, as everywhere in Earn). A pool with no fresh price
 * is skipped rather than counted as zero. Null when no pool has a rate.
 */
const bestApyForOption = (option: BlendEarnAssetOption): number | null =>
  option.pools.reduce<number | null>((best, pool) => {
    const rate = pool.supplyApy;
    if (rate === null) {
      return best;
    }
    return best === null || rate > best ? rate : best;
  }, null);

/**
 * What the account could earn in a year by depositing what it already holds:
 * the empty Positions tab's "Earn up to".
 *
 * Each held, priced, depositable token is valued at ITS OWN best rate and
 * the results summed: one blended rate over a mixed basket would credit a
 * low-rate token with the wrong figure. Tokens no pool accepts, and tokens
 * with no price, are skipped rather than counted at zero.
 *
 * `usd` is null when there is nothing to total (no catalog, or nothing
 * depositable held). The empty state then shows `bestApy` alone, a ceiling
 * rate rather than a dollar figure it can't back.
 */
export const projectAnnualEarnings = ({
  options,
  balances,
  networkDetails,
}: {
  options: BlendEarnAssetOption[] | null;
  balances: PricedBalanceMap;
  networkDetails: NetworkDetails;
}): { usd: string | null; bestApy: number | null } => {
  if (!options?.length) {
    return { usd: null, bestApy: null };
  }

  let bestApy: number | null = null;
  let total = new BigNumber(0);
  let counted = 0;

  options.forEach((option) => {
    const apy = bestApyForOption(option);
    if (apy === null) {
      return;
    }
    if (bestApy === null || apy > bestApy) {
      bestApy = apy;
    }

    const balance = getBalanceByContractId(
      option.assetId,
      balances,
      networkDetails,
    );
    if (!balance) {
      return;
    }

    // What could actually be deposited: XLM's total includes the minimum
    // balance the account must keep, and `available` leaves it out. In whole
    // tokens, as prices are: a Soroban token's balance is in raw units.
    const spendable =
      "available" in balance && balance.available
        ? balance.available
        : getBalanceInWholeUnits(balance);
    const price = balance.currentPrice;
    if (spendable.lte(0) || !price || price.isZero()) {
      return;
    }

    counted += 1;
    total = total.plus(spendable.multipliedBy(price).multipliedBy(apy));
  });

  return { usd: counted ? total.toFixed(2) : null, bestApy };
};
