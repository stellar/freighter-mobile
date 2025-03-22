import AsyncStorage from "@react-native-async-storage/async-storage";
import { NetworkDetails, TESTNET_NETWORK_DETAILS } from "config/constants";
import { AssetToken, BalanceMap } from "config/types";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import { debug } from "helpers/debug";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AssetIconsState {
  icons: Record<string, string>;
  fetchIconUrl: (params: {
    asset: AssetToken;
    networkDetails: NetworkDetails;
  }) => Promise<string>;
  fetchBalancesIcons: (balances: BalanceMap) => Promise<void>;
}

/**
 * Asset Icons Store
 *
 * Manages and caches asset icon URLs using Zustand with persistence.
 * Icons are fetched only once and cached to avoid unnecessary API calls.
 * The cache persists across sessions using AsyncStorage.
 */
export const useAssetIconsStore = create<AssetIconsState>()(
  persist(
    (set, get) => ({
      icons: {},
      fetchIconUrl: async ({ asset, networkDetails }) => {
        const cacheKey = getTokenIdentifier(asset);
        const cachedIcon = get().icons[cacheKey];

        debug(
          "AssetIconsStore",
          `Fetching icon for ${cacheKey}`,
          cachedIcon ? "Found in cache" : "Cache miss",
          cachedIcon,
        );

        // Return cached icon if available
        if (cachedIcon) {
          return cachedIcon;
        }

        try {
          // Fetch icon URL if not cached
          const iconUrl = await getIconUrlFromIssuer({
            assetCode: asset.code,
            issuerKey: asset.issuer.key,
            networkDetails,
          });

          debug(
            "AssetIconsStore",
            `Icon fetched for ${cacheKey}`,
            iconUrl ? "Icon found" : "No icon available",
            iconUrl,
          );

          // Cache the icon URL (even if empty, to avoid re-fetching)
          set((state) => ({
            icons: {
              ...state.icons,
              [cacheKey]: iconUrl,
            },
          }));

          return iconUrl;
        } catch (error) {
          debug(
            "AssetIconsStore",
            `Failed to fetch icon for ${cacheKey}`,
            error,
          );
          return "";
        }
      },
      fetchBalancesIcons: async (balances) => {
        const balanceCount = Object.keys(balances).length;
        debug(
          "AssetIconsStore",
          `Starting batch icon fetch for ${balanceCount} balances`,
        );

        const startTime = Date.now();

        // Process all balances in parallel using Promise.all
        await Promise.all(
          Object.entries(balances).map(async ([id, balance]) => {
            // Skip liquidity pools
            if (isLiquidityPool(balance)) {
              debug("AssetIconsStore", `Skipping LP token ${id}`);
              return;
            }

            if (balance.token.type === "native") {
              return;
            }

            // Fetching icon will save it to the cache automatically
            // so that we don't need to return anything
            await get().fetchIconUrl({
              asset: balance.token,
              networkDetails: TESTNET_NETWORK_DETAILS,
            });
          }),
        );

        const duration = Date.now() - startTime;
        debug(
          "AssetIconsStore",
          `Completed batch icon fetch in ${duration}ms`,
          `Processed ${balanceCount} icons`,
        );
      },
    }),
    {
      name: "asset-icons-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
