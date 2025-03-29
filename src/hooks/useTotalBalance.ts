import { BigNumber } from "bignumber.js";
import { useBalancesStore } from "ducks/balances";
import { formatFiatAmount } from "helpers/formatAmount";
import { useMemo } from "react";

interface TotalBalance {
  formattedBalance: string;
  rawBalance: BigNumber;
}

/**
 * Hook to calculate the total balance from pricedBalances
 * Returns formatted and raw balance values
 * Optimized to only react to fiatTotal changes using a string key
 */
export const useTotalBalance = (): TotalBalance => {
  const pricedBalances = useBalancesStore((state) => state.pricedBalances);

  // Create a key that only changes when fiatTotal values change
  const fiatTotalsKey = Object.values(pricedBalances)
    .map((balance) => balance.fiatTotal?.toString() || "0")
    .join(",");

  return useMemo(() => {
    const rawBalance = Object.values(pricedBalances).reduce(
      (total, balance) => total.plus(balance.fiatTotal || 0),
      new BigNumber(0),
    );

    return {
      formattedBalance: formatFiatAmount(rawBalance),
      rawBalance,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiatTotalsKey]);
};
