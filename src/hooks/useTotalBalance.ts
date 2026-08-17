import { BigNumber } from "bignumber.js";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { getTotalUsdLabel } from "helpers/balances";
import { formatFiatAmount } from "helpers/formatAmount";
import { isMainnet } from "helpers/networks";
import { useMemo } from "react";

interface TotalBalance {
  formattedBalance: string;
  /**
   * What the Home header should actually show: an amount, "$0.00" or "--".
   * Unlike `formattedBalance` (a bare sum, which reads as a confident $0.00
   * when prices are missing), this routes through {@link getTotalUsdLabel} —
   * the same rule the wallets-list rows use, so the header and the active
   * account's row always agree.
   */
  totalLabel: string;
  rawBalance: BigNumber;
  /**
   * Whether any held asset is actually priced. False on e.g. testnet (fiat
   * is gated off) or before prices load, where the summed total is a
   * placeholder "$0.00" rather than a real value. The Home header shows the
   * total either way by design; consumers that prefer hiding a placeholder
   * can gate on this.
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
  const isFunded = useBalancesStore((state) => state.isFunded);
  const balancesError = useBalancesStore((state) => state.error);
  const network = useAuthenticationStore((state) => state.network);

  // Create a key that only changes when fiatTotal values change
  const fiatTotalsKey = Object.values(pricedBalances)
    .map((balance) => balance.fiatTotal?.toString() || "0")
    .join(",");

  return useMemo(() => {
    const rawBalance = Object.values(pricedBalances).reduce(
      (total, balance) => total.plus(balance.fiatTotal || 0),
      new BigNumber(0),
    );

    // A total is only "real" when at least one held asset is priced;
    // otherwise (e.g. testnet, where fiat is gated off, or before prices
    // load) the sum is a placeholder zero.
    const hasFiatTotal = Object.values(pricedBalances).some(
      (balance) => balance.fiatTotal != null,
    );

    return {
      formattedBalance: formatFiatAmount(rawBalance),
      totalLabel: getTotalUsdLabel({
        hasError: balancesError != null,
        hasPriceFeed: isMainnet(network),
        isFunded,
        hasPrices: hasFiatTotal,
        totalUsd: rawBalance,
      }),
      rawBalance,
      hasFiatTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiatTotalsKey, isFunded, balancesError, network]);
};
