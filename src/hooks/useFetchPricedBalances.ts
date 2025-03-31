import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useEffect } from "react";

/**
 * Parameters for fetching priced balances
 * @property {string} publicKey - The Stellar account public key
 * @property {NETWORKS} network - The Stellar network to fetch from (e.g., PUBLIC, TESTNET)
 */
interface FetchPricedBalancesParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Hook to fetch and manage priced balances for a Stellar account.
 *
 * Automatically fetches account balances with pricing information when:
 * - The component mounts
 * - The public key changes
 * - The network changes
 *
 * @param {FetchPricedBalancesParams} params - The parameters for fetching balances
 * @param {string} params.publicKey - The Stellar account public key
 * @param {NETWORKS} params.network - The Stellar network to fetch from
 *
 * @example
 * // Basic usage
 * function AccountBalances() {
 *   useFetchPricedBalances({
 *     publicKey: "GBBD...",
 *     network: NETWORKS.PUBLIC
 *   });
 *   // ... rest of the component
 * }
 *
 * @remarks
 * - Uses the balances store to manage state
 * - Automatically refetches when dependencies change
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
