import { NETWORK_URLS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { debug } from "helpers/debug";
import { useEffect } from "react";

/**
 * Hook to fetch and manage token icons for balances.
 *
 * This hook performs two main functions:
 * 1. Automatically fetches and caches icons when balances change
 * 2. Periodically refreshes cached icons in the background
 *
 * Features:
 * - Monitors balance changes and fetches new icons as needed
 * - Caches icons to avoid redundant network requests
 * - Implements low-priority background refresh after 5s delay
 * - Cleans up background tasks on unmount
 *
 * @param {NETWORK_URLS} networkUrl - The network URL to fetch icons from
 *
 * @example
 * // Basic usage
 * function TokenList() {
 *   useFetchTokenIcons(NETWORK_URLS.PUBLIC);
 *   // ... rest of the component
 * }
 *
 * @remarks
 * - Icon refresh is delayed by 5s to avoid interfering with critical operations
 * - Uses the token icons store for caching and persistence
 */
export const useFetchTokenIcons = (networkUrl: NETWORK_URLS) => {
  const balances = useBalancesStore((state) => state.balances);
  const { fetchBalancesIcons, refreshIcons } = useTokenIconsStore();

  // Create a balances key that changes only when the set of balances changes
  const balancesKey = Object.keys(balances).sort().join(",");

  useEffect(() => {
    if (balancesKey.length > 3) {
      debug("useFetchTokenIcons", "Balances changed", balancesKey);

      // Fetch icons in the background
      fetchBalancesIcons({ balances, networkUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesKey, networkUrl, fetchBalancesIcons]);

  // Try refreshing icons after some initial delay (5s) so that it doesn't
  // interfere with any other process that may be loading since this
  // is a lower priority operation
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshIcons();
    }, 5000);

    return () => clearTimeout(timer);
  }, [refreshIcons]);
};
