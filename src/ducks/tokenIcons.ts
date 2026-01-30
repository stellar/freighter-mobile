import AsyncStorage from "@react-native-async-storage/async-storage";
import { logos } from "assets/logos";
import {
  CIRCLE_USDC_CONTRACT,
  CIRCLE_USDC_ISSUER,
  NETWORKS,
  USDC_CODE,
} from "config/constants";
import {
  NonNativeToken,
  BalanceMap,
  TokenTypeWithCustomToken,
} from "config/types";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import { debug } from "helpers/debug";
import { getIconUrl } from "helpers/getIconUrl";
import { Image } from "react-native";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Represents a token icon with its source URL and network context
 * @property {string} imageUrl - The URL of the icon image
 * @property {NETWORK_URLS} networkUrl - The network URL where this icon was fetched from
 * @property {boolean} [isValidated] - Whether the icon URL has been validated
 * @property {boolean | null} [isValid] - Validation result (null = not validated, true = valid, false = invalid)
 */
export interface Icon {
  imageUrl: string;
  network: NETWORKS;
  isValidated?: boolean;
  isValid?: boolean | null;
}

/**
 * State and actions for managing token icons
 * @property {Record<string, Icon>} icons - Cached icon data mapped by token identifier
 * @property {number | null} lastRefreshed - Timestamp of the last icon refresh operation
 */
interface TokenIconsState {
  icons: Record<string, Icon>;
  lastRefreshed: number | null;
  /**
   * Caches a single token icon
   * @param {Object} params - Function parameters
   * @param { Record<string, Icon>} params.icons - A map of token ID to Icon
   */
  cacheTokenIcons: (params: { icons: Record<string, Icon> }) => void;
  /**
   * Caches all icons from the token lists
   * @param {Object} params - Function parameters
   * @param {NETWORKS} params.network - The network to fetch from
   */
  cacheTokenListIcons: (params: { network: NETWORKS }) => Promise<void>;
  /**
   * Fetches an icon URL for a given token
   * @param {Object} params - Function parameters
   * @param {NonNativeToken} params.token - The token to fetch the icon for
   * @param {NETWORKS} params.network - The network to fetch from
   * @returns {Promise<Icon>} The fetched icon data
   */
  fetchIconUrl: (params: {
    token: NonNativeToken;
    network: NETWORKS;
  }) => Promise<Icon>;
  /**
   * Fetches icons for all tokens in a balance map
   * @param {Object} params - Function parameters
   * @param {BalanceMap} params.balances - Map of balances to fetch icons for
   * @param {NETWORKS} params.network - The network to fetch from
   */
  fetchBalancesIcons: (params: {
    balances: BalanceMap;
    network: NETWORKS;
  }) => Promise<void>;
  /**
   * Refreshes all cached icons if 24 hours have passed since last refresh
   * Processes icons in batches to avoid overwhelming the network
   */
  refreshIcons: () => void;
  /**
   * Lazy validation trigger for a token icon
   * Only validates if not already validated
   * @param {string} identifier - The token identifier to validate
   */
  validateIconOnAccess: (identifier: string) => Promise<void>;
}

/** Number of icons to process in each batch */
const BATCH_SIZE = 3;
/** Delay in milliseconds between processing batches */
const BATCH_DELAY = 1000;

/**
 * Validates an icon URL by attempting to fetch it
 * @param {string} url - The URL to validate
 * @returns {Promise<boolean>} True if the URL is valid and accessible
 */
const validateIconUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;

  // If it's not a remote URL (http/https), assume it's valid (local resource or data URI)
  if (
    typeof url !== "string" ||
    (!url.startsWith("http") && !url.startsWith("https"))
  ) {
    return true;
  }

  // Use Image.prefetch to validate and cache the image
  try {
    const fetchPromise = Image.prefetch(url)
      .then(() => true)
      .catch(() => false);

    // 3 second timeout
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 3000);
    });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    return false;
  }
};

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
      | TokenIconsState
      | Partial<TokenIconsState>
      | ((
          state: TokenIconsState,
        ) => TokenIconsState | Partial<TokenIconsState>),
  ) => void;
}) => {
  const { entries, batchIndex, updatedIcons, startTime, set } = params;
  const batch = entries.slice(0, BATCH_SIZE);
  const remainingEntries = entries.slice(BATCH_SIZE);

  // Process current batch
  await Promise.all(
    batch.map(async ([cacheKey, icon]) => {
      try {
        // Parse the cache key to get token details
        const [tokenCode, issuerKey] = cacheKey.split(":");
        const imageUrl = await getIconUrl({
          asset: {
            code: tokenCode,
            issuer: issuerKey,
          },
          network: icon.network,
        });

        updatedIcons[cacheKey] = {
          imageUrl,
          network: icon.network,
          isValidated: false,
          isValid: null,
        };
      } catch (error) {
        // Keep the existing icon URL if refresh fails, but mark for re-validation
        updatedIcons[cacheKey] = {
          ...icon,
          isValidated: false,
        };
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
 * Token Icons Store
 *
 * Manages and caches token icon URLs using Zustand with persistence.
 *
 * Features:
 * - Caches icons to avoid unnecessary API calls
 * - Persists cache across sessions using AsyncStorage
 * - Refreshes icons every 24 hours in the background
 * - Processes icon updates in batches to manage network load
 * - Handles network errors gracefully
 *
 * @example
 * // Fetch icon for a specific token
 * const { fetchIconUrl } = useTokenIconsStore();
 * const icon = await fetchIconUrl({
 *   token: myToken,
 *   networkUrl: NETWORK_URLS.PUBLIC
 * });
 *
 * // Access cached icons
 * const { icons } = useTokenIconsStore();
 * const cachedIcon = icons[tokenIdentifier];
 */
export const useTokenIconsStore = create<TokenIconsState>()(
  persist(
    (set, get) => ({
      icons: {},
      lastRefreshed: null,
      cacheTokenIcons: ({ icons }) => {
        set((state) => ({
          icons: {
            ...state.icons,
            ...icons,
          },
        }));
      },
      cacheTokenListIcons: async ({ network }) => {
        const { getVerifiedTokens } = useVerifiedTokensStore.getState();
        const verifiedTokens = await getVerifiedTokens({ network });
        const iconMap = verifiedTokens.reduce(
          (prev, curr) => {
            if (curr.icon) {
              let iconUrl = curr.icon;
              let isValidated = false;
              let isValid: boolean | null = null;

              if (
                network === NETWORKS.PUBLIC &&
                curr.code === USDC_CODE &&
                (curr.issuer === CIRCLE_USDC_ISSUER ||
                  curr.contract === CIRCLE_USDC_CONTRACT)
              ) {
                iconUrl = logos.usdc as unknown as string;
                isValidated = true;
                isValid = true;
              }

              const icon: Icon = {
                imageUrl: iconUrl,
                network,
                isValidated,
                isValid,
              };
              // eslint-disable-next-line no-param-reassign
              prev[`${curr.code}:${curr.issuer}`] = icon;

              // We should cache icons by contract ID as well, to be used when adding new tokens by C address.
              if (curr.contract) {
                // eslint-disable-next-line no-param-reassign
                prev[`${curr.code}:${curr.contract}`] = icon;
              }
            }
            return prev;
          },
          {} as Record<string, Icon>,
        );

        set((state) => ({
          icons: {
            // Mark existing icons as not validated to trigger lazy validation
            // This covers "On app start: mark all existing cached icons as isValidated: false"
            // effectively resetting validation state on mass update.
            ...state.icons,
            ...Object.fromEntries(
              Object.keys(state.icons).map((key) => [
                key,
                { ...state.icons[key], isValidated: false },
              ]),
            ),
            ...iconMap,
          },
        }));
      },
      fetchIconUrl: async ({ token, network }) => {
        const cacheKey = getTokenIdentifier(token);

        const cachedIcon = get().icons[cacheKey];

        // Return cached icon if available
        if (cachedIcon) {
          return cachedIcon;
        }

        try {
          // Fetch icon URL if not cached
          const imageUrl = await getIconUrl({
            asset: {
              code: token.code,
              issuer: token.issuer.key,
            },
            network,
          });

          const icon: Icon = {
            imageUrl,
            network,
            isValidated: false,
            isValid: null,
          };

          debug(
            "TokenIconsStore",
            `Icon fetched for ${cacheKey}`,
            imageUrl ? "Icon found" : "No icon available",
            icon,
          );

          // Cache the icon URL (even if empty, to avoid re-fetching)
          set((state) => {
            const currentIcon = state.icons[cacheKey];
            // If we already have the same icon data, don't update to avoid triggering re-renders
            // or resetting validation state unnecessarily
            if (
              currentIcon &&
              currentIcon.imageUrl === icon.imageUrl &&
              currentIcon.network === icon.network
            ) {
              return state;
            }

            return {
              icons: {
                ...state.icons,
                [cacheKey]: icon,
              },
            };
          });

          // Validate in background
          if (imageUrl) {
            get().validateIconOnAccess(cacheKey);
          }

          return icon;
        } catch (error) {
          return {
            imageUrl: "",
            network,
            isValidated: true,
            isValid: false,
          };
        }
      },
      fetchBalancesIcons: async ({ balances, network }) => {
        // Process all balances in parallel using Promise.all
        await Promise.all(
          Object.entries(balances).map(async ([id, balance]) => {
            // Skip liquidity pools
            if (isLiquidityPool(balance)) {
              debug("TokenIconsStore", `Skipping LP token ${id}`);
              return;
            }

            if (!("token" in balance)) {
              return;
            }

            if (balance.token.type === TokenTypeWithCustomToken.NATIVE) {
              return;
            }

            // Fetching icon will save it to the cache automatically
            // so that we don't need to return anything
            const icon = await get().fetchIconUrl({
              token: balance.token,
              network,
            });

            // Validate immediately for user's balances
            if (icon && icon.imageUrl && !icon.isValidated) {
              const cacheKey = getTokenIdentifier(balance.token);
              await get().validateIconOnAccess(cacheKey);
            }
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
          "TokenIconsStore",
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
      validateIconOnAccess: async (identifier) => {
        const icon = get().icons[identifier];
        if (
          !icon ||
          icon.isValidated ||
          (!icon.imageUrl && icon.imageUrl !== "")
        ) {
          return;
        }

        if (!icon.imageUrl) {
          set((state) => ({
            icons: {
              ...state.icons,
              [identifier]: {
                ...state.icons[identifier],
                isValidated: true,
                isValid: false,
              },
            },
          }));
          return;
        }

        const isValid = await validateIconUrl(icon.imageUrl);

        set((state) => {
          const currentIcon = state.icons[identifier];
          // Check if icon still exists and matches
          if (!currentIcon || currentIcon.imageUrl !== icon.imageUrl) {
            return state;
          }

          if (isValid) {
            return {
              icons: {
                ...state.icons,
                [identifier]: {
                  ...currentIcon,
                  isValidated: true,
                  isValid: true,
                },
              },
            };
          }

          // If validation failed, we enable retry logic on next access only if needed,
          // but specifically for "forever loading" issues (like ARST), we should probably
          // stop trying if it fails confirmedly.
          // However, to fix the specific "loading forever" bug:
          // We must mark it as validated even if false, so UI stops spinning.
          return {
            icons: {
              ...state.icons,
              [identifier]: {
                ...currentIcon,
                isValidated: true,
                isValid: false,
              },
            },
          };
        });
      },
    }),
    {
      name: "token-icons-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
