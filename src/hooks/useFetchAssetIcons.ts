import { NETWORK_URLS } from "config/constants";
import { useAssetIconsStore } from "ducks/assetIcons";
import { useBalancesStore } from "ducks/balances";
import { debug } from "helpers/debug";
import { useEffect } from "react";

/**
 * Hook to fetch asset icons whenever balances change.
 * Icons are fetched in the background and cached in the asset icons store.
 *
 * The hook will:
 * 1. Monitor balances for changes
 * 2. Fetch icons for all assets in the background
 * 3. Cache the icons in the asset icons store
 */
export const useFetchAssetIcons = (networkUrl: NETWORK_URLS) => {
  const balances = useBalancesStore((state) => state.balances);
  const { fetchBalancesIcons, refreshIcons } = useAssetIconsStore();

  // Create a balances key that changes only when the set of balances changes
  const balancesKey = Object.keys(balances).sort().join(",");

  useEffect(() => {
    debug("useFetchAssetIcons", "Balances changed", balancesKey);
    if (balancesKey.length > 3) {
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
