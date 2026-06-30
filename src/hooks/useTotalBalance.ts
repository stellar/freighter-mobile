import { BigNumber } from "bignumber.js";
import { useBalancesStore } from "ducks/balances";
import { formatFiatAmount } from "helpers/formatAmount";
import { useMemo } from "react";

interface TotalBalance {
  formattedBalance: string;
  rawBalance: BigNumber;
  /**
   * Whether any held asset is actually priced. When false (e.g. testnet, where
   * fiat is gated off, or before prices load) consumers should hide the total
   * rather than render a misleading "$0.00".
   */
  hasFiatTotal: boolean;
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

    // A total is only meaningful when at least one held asset is priced.
    // Otherwise (e.g. testnet, where fiat is gated off, or before prices load)
    // the sum is a misleading "$0.00" — consumers hide the total instead.
    const hasFiatTotal = Object.values(pricedBalances).some(
      (balance) => balance.fiatTotal != null,
    );

    return {
      formattedBalance: formatFiatAmount(rawBalance),
      rawBalance,
      hasFiatTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiatTotalsKey]);
};
