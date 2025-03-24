import AsyncStorage from "@react-native-async-storage/async-storage";
import { NETWORK_URLS } from "config/constants";
import { AssetToken, BalanceMap } from "config/types";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import { debug } from "helpers/debug";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Icon {
  imageUrl: string;
  networkUrl: NETWORK_URLS;
}

interface AssetIconsState {
  icons: Record<string, Icon>;
  lastRefreshed: number | null;
  fetchIconUrl: (params: {
    asset: AssetToken;
    networkUrl: NETWORK_URLS;
  }) => Promise<Icon>;
  fetchBalancesIcons: (params: {
    balances: BalanceMap;
    networkUrl: NETWORK_URLS;
  }) => Promise<void>;
  refreshIcons: () => void;
}

const BATCH_SIZE = 3; // Process 3 icons at a time
const BATCH_DELAY = 1000; // 1 second delay between batches

/**
 * Process a batch of icons for refresh
 * @param params Parameters for batch processing
 * @param params.entries Array of icon entries to process
 * @param params.batchIndex Current batch index
 * @param params.updatedIcons Record to store updated icons
 * @param params.startTime Start time of the overall refresh operation
 * @param params.set Zustand set function to update store
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
 * Icons are fetched only once and cached to avoid unnecessary API calls.
 * The cache persists across sessions using AsyncStorage.
 */
export const useAssetIconsStore = create<AssetIconsState>()(
  persist(
    (set, get) => ({
      icons: {},
      lastRefreshed: null,
      fetchIconUrl: async ({ asset, networkUrl }) => {
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
