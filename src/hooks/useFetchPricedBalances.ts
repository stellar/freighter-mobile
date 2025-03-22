import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useEffect } from "react";

interface FetchPricedBalancesParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Hook to fetch priced balances for a given public key and network.
 * Balances are fetched when the component mounts or when the publicKey/network changes.
 *
 * @param params.publicKey - The public key to fetch balances for
 * @param params.network - The network to fetch balances from
 */
export const useFetchPricedBalances = ({
  publicKey,
  network,
}: FetchPricedBalancesParams) => {
  const fetchAccountBalances = useBalancesStore(
    (state) => state.fetchAccountBalances,
  );

  useEffect(() => {
    fetchAccountBalances({
      publicKey,
      network,
    });
  }, [fetchAccountBalances, publicKey, network]);
};
