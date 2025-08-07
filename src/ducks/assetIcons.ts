import AsyncStorage from "@react-native-async-storage/async-storage";
import { NETWORK_URLS } from "config/constants";
import { AssetToken, BalanceMap } from "config/types";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import { debug } from "helpers/debug";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Represents an asset icon with its source URL and network context
 * @property {string} imageUrl - The URL of the icon image
 * @property {NETWORK_URLS} networkUrl - The network URL where this icon was fetched from
 */
interface Icon {
  imageUrl: string;
  networkUrl: NETWORK_URLS;
}

/**
 * State and actions for managing asset icons
 * @property {Record<string, Icon>} icons - Cached icon data mapped by token identifier
 * @property {number | null} lastRefreshed - Timestamp of the last icon refresh operation
 */
interface AssetIconsState {
  icons: Record<string, Icon>;
  lastRefreshed: number | null;
  /**
   * Fetches an icon URL for a given asset
   * @param {Object} params - Function parameters
   * @param {AssetToken} params.asset - The asset to fetch the icon for
   * @param {NETWORK_URLS} params.networkUrl - The network URL to fetch from
   * @returns {Promise<Icon>} The fetched icon data
   */
  fetchIconUrl: (params: {
    asset: AssetToken;
    networkUrl: NETWORK_URLS;
  }) => Promise<Icon>;
  /**
   * Fetches icons for all assets in a balance map
   * @param {Object} params - Function parameters
   * @param {BalanceMap} params.balances - Map of balances to fetch icons for
   * @param {NETWORK_URLS} params.networkUrl - The network URL to fetch from
   */
  fetchBalancesIcons: (params: {
    balances: BalanceMap;
    networkUrl: NETWORK_URLS;
  }) => Promise<void>;
  /**
   * Refreshes all cached icons if 24 hours have passed since last refresh
   * Processes icons in batches to avoid overwhelming the network
   */
  refreshIcons: () => void;
}

/** Number of icons to process in each batch */
const BATCH_SIZE = 3;
/** Delay in milliseconds between processing batches */
const BATCH_DELAY = 1000;

/**
 * Processes a batch of icons for refresh in a low-priority background task
 *
 * This function:
 * 1. Takes a batch of icons from the input array
 * 2. Processes them in parallel
 * 3. Updates the store with refreshed icons
 * 4. Schedules the next batch with a delay
 *
 * @param {Object} params - Function parameters
 * @param {[string, Icon][]} params.entries - Array of icon entries to process
 * @param {number} params.batchIndex - Current batch index for debugging
 * @param {Record<string, Icon>} params.updatedIcons - Accumulator for updated icons
 * @param {number} params.startTime - Start time of the refresh operation
 * @param {Function} params.set - Zustand set function to update store
 */
const processIconBatches = async (params: {
  entries: [string, Icon][];
  batchIndex: number;
  updatedIcons: Record<string, Icon>;
  startTime: number;
  set: (
    partial:
      | AssetIconsState
      | Partial<AssetIconsState>
      | ((
          state: AssetIconsState,
        ) => AssetIconsState | Partial<AssetIconsState>),
  ) => void;
}) => {
  const { entries, batchIndex, updatedIcons, startTime, set } = params;
  const batch = entries.slice(0, BATCH_SIZE);
  const remainingEntries = entries.slice(BATCH_SIZE);

  // Process current batch
  await Promise.all(
    batch.map(async ([cacheKey, icon]) => {
      try {
        // Parse the cache key to get asset details
        const [assetCode, issuerKey] = cacheKey.split(":");

        const imageUrl = await getIconUrlFromIssuer({
          assetCode,
          issuerKey,
          networkUrl: icon.networkUrl,
        });

        updatedIcons[cacheKey] = {
          imageUrl,
          networkUrl: icon.networkUrl,
        };
      } catch (error) {
        // Keep the existing icon URL if refresh fails
        updatedIcons[cacheKey] = icon;
      }
    }),
  );

  // Update icons after each batch
  set((state) => ({
    icons: {
      ...state.icons,
      ...updatedIcons,
    },
  }));

  // Process next batch if there are remaining entries
  if (remainingEntries.length > 0) {
    setTimeout(() => {
      processIconBatches({
        entries: remainingEntries,
        batchIndex: batchIndex + 1,
        updatedIcons,
        startTime,
        set,
      });
    }, BATCH_DELAY);
  } else {
    // All batches completed, update lastRefreshed
    const now = Date.now();
    set({ lastRefreshed: now });
  }
};

/**
 * Asset Icons Store
 *
 * Manages and caches asset icon URLs using Zustand with persistence.
 *
 * Features:
 * - Caches icons to avoid unnecessary API calls
 * - Persists cache across sessions using AsyncStorage
 * - Refreshes icons every 24 hours in the background
 * - Processes icon updates in batches to manage network load
 * - Handles network errors gracefully
 *
 * @example
 * // Fetch icon for a specific asset
 * const { fetchIconUrl } = useAssetIconsStore();
 * const icon = await fetchIconUrl({
 *   asset: myAsset,
 *   networkUrl: NETWORK_URLS.PUBLIC
 * });
 *
 * // Access cached icons
 * const { icons } = useAssetIconsStore();
 * const cachedIcon = icons[tokenIdentifier];
 */
export const useAssetIconsStore = create<AssetIconsState>()(
  persist(
    (set, get) => ({
      icons: {},
      lastRefreshed: null,
      fetchIconUrl: async ({ asset, networkUrl }) => {
        const cacheKey = getTokenIdentifier(asset);
        const cachedIcon = get().icons[cacheKey];

        // Return cached icon if available
        if (cachedIcon) {
          return cachedIcon;
        }

        try {
          // Fetch icon URL if not cached
          const imageUrl = await getIconUrlFromIssuer({
            assetCode: asset.code,
            issuerKey: asset.issuer.key,
            networkUrl,
          });

          const icon: Icon = {
            imageUrl,
            networkUrl,
          };

          debug(
            "AssetIconsStore",
            `Icon fetched for ${cacheKey}`,
            imageUrl ? "Icon found" : "No icon available",
            icon,
          );

          // Cache the icon URL (even if empty, to avoid re-fetching)
          set((state) => ({
            icons: {
              ...state.icons,
              [cacheKey]: icon,
            },
          }));

          return icon;
        } catch (error) {
          return {
            imageUrl: "",
            networkUrl,
          };
        }
      },
      fetchBalancesIcons: async ({ balances, networkUrl }) => {
        // Process all balances in parallel using Promise.all
        await Promise.all(
          Object.entries(balances).map(async ([id, balance]) => {
            // Skip liquidity pools
            if (isLiquidityPool(balance)) {
              debug("AssetIconsStore", `Skipping LP token ${id}`);
              return;
            }

            if (!("token" in balance)) {
              return;
            }

            if (balance.token.type === "native") {
              return;
            }

            // Fetching icon will save it to the cache automatically
            // so that we don't need to return anything
            await get().fetchIconUrl({
              asset: balance.token,
              networkUrl,
            });
          }),
        );
      },
      refreshIcons: () => {
        const { icons, lastRefreshed } = get();
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        // If lastRefreshed is not set yet, this means we're starting fresh
        // and the app will already fetch all icons from scratch so let's
        // simply set the lastRefreshed timestamp to now to avoid unnecessarily
        // going through the refresh api requests below
        if (!lastRefreshed) {
          set({ lastRefreshed: now });
          return;
        }

        // Check if we've refreshed in the last 24 hours
        if (now - lastRefreshed < ONE_DAY_MS) {
          return;
        }

        const iconCount = Object.keys(icons).length;
        debug(
          "AssetIconsStore",
          `Starting icon refresh for ${iconCount} cached icons`,
        );

        const startTime = Date.now();
        const updatedIcons: Record<string, Icon> = {};

        // Start processing the first batch
        processIconBatches({
          entries: Object.entries(icons),
          batchIndex: 0,
          updatedIcons,
          startTime,
          set,
        });
      },
    }),
    {
      name: "asset-icons-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
