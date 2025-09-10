import { NETWORKS } from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
import { useEffect } from "react";

/**
 * Parameters for fetching collectibles
 * @property {string} [publicKey] - The Stellar account public key
 * @property {NETWORKS} [network] - The Stellar network to fetch from (e.g., PUBLIC, TESTNET)
 */
interface FetchCollectiblesParams {
  publicKey?: string;
  network?: NETWORKS;
}

/**
 * Hook to fetch and manage collectibles for a Stellar account.
 *
 * Automatically fetches account collectibles when:
 * - The component mounts
 * - The public key changes
 * - The network changes
 *
 * @param {FetchCollectiblesParams} params - The parameters for fetching collectibles
 * @param {string} [params.publicKey] - The Stellar account public key
 * @param {NETWORKS} [params.network] - The Stellar network to fetch from
 *
 * @example
 * // Basic usage
 * function AccountCollectibles() {
 *   useFetchCollectibles({
 *     publicKey: "GBBD...",
 *     network: NETWORKS.PUBLIC
 *   });
 *   // ... rest of the component
 * }
 *
 * @remarks
 * - Uses the collectibles store to manage state
 * - Automatically refetches when dependencies change
 * - Prevents duplicate requests with built-in loading state check
 * - Only fetches when both publicKey and network are provided
 */
export const useFetchCollectibles = ({
  publicKey,
  network,
}: FetchCollectiblesParams) => {
  const fetchCollectibles = useCollectiblesStore(
    (state) => state.fetchCollectibles,
  );

  useEffect(() => {
    if (publicKey && network) {
      fetchCollectibles({
        publicKey,
        network,
      });
    }
  }, [fetchCollectibles, publicKey, network]);
};
