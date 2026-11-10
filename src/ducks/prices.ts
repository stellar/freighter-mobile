import { NETWORKS } from "config/constants";
import { Balance, TokenIdentifier, TokenPricesMap } from "config/types";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

/**
 * Stable empty map so selectors return a referentially-stable value when a
 * network has no cached prices yet (avoids a fresh `{}` re-render each call).
 */
const EMPTY_PRICES: TokenPricesMap = Object.freeze({});

interface PricesState {
  /**
   * Per-network price caches, keyed by {@link NETWORKS}. v2 prices are
   * network-scoped, so keying the cache by network makes a cross-network read
   * impossible by construction — a network *switch* never needs to clear the
   * cache (which previously caused a blank-price flicker), and a price response
   * that resolves after the user switched networks still lands in its own
   * network's submap rather than polluting the active one.
   */
  pricesByNetwork: Record<string, TokenPricesMap>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fetchPricesForBalances: (params: {
    balances: Record<string, Balance>;
    publicKey: string;
    network: NETWORKS;
  }) => Promise<void>;
  /**
   * Fetch prices for arbitrary token identifiers (e.g., from Blockaid
   * diffs). Resolves `true` when the requested quotes are available (fetched
   * or already cached), `false` when the request failed — so callers that
   * derive values from these quotes can avoid caching results computed from
   * missing prices.
   */
  fetchPricesForTokenIds: (params: {
    tokens: TokenIdentifier[];
    /** Active network — required by the network-scoped v2 prices endpoint. */
    network: NETWORKS;
    /** Refetch even tokens already in the map (e.g. pull-to-refresh). */
    forceRefresh?: boolean;
  }) => Promise<boolean>;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  pricesByNetwork: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  /** Fetch prices for tokens present in the user's balances. */
  fetchPricesForBalances: async ({ balances, network }) => {
    try {
      set({ isLoading: true, error: null });

      const tokens = getTokenIdentifiersFromBalances(balances);
      if (tokens.length === 0) {
        set({ isLoading: false, lastUpdated: Date.now() });
        return;
      }

      // Refetch every held token on each call — no per-token dedupe here. The
      // balance poll (and pull-to-refresh) is the price-refresh mechanism for
      // held assets, so deduping would freeze currentPrice/fiatTotal (and any
      // null-filled entries) for the rest of the session.
      // No network guard needed — a late response only ever writes its own
      // network's submap.
      const response = await fetchTokenPrices({ tokens, network });

      set({
        pricesByNetwork: {
          ...get().pricesByNetwork,
          [network]: {
            ...(get().pricesByNetwork[network] ?? EMPTY_PRICES),
            ...response,
          },
        },
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch token prices",
        isLoading: false,
      });
    }
  },
  /** Lightweight fetch for arbitrary tokens */
  fetchPricesForTokenIds: async ({ tokens, network, forceRefresh = false }) => {
    try {
      if (!tokens || tokens.length === 0) return true;

      // Skip tokens already loaded to avoid duplicate requests — unless the
      // caller forces a refresh (e.g. pull-to-refresh), since otherwise a price
      // fetched once would never update for the rest of the session.
      const cached = get().pricesByNetwork[network] ?? EMPTY_PRICES;
      const toFetch = forceRefresh ? tokens : tokens.filter((t) => !cached[t]);
      if (toFetch.length === 0) return true;

      const response = await fetchTokenPrices({
        tokens: toFetch,
        network,
      });

      set({
        pricesByNetwork: {
          ...get().pricesByNetwork,
          [network]: {
            ...(get().pricesByNetwork[network] ?? EMPTY_PRICES),
            ...response,
          },
        },
        lastUpdated: Date.now(),
      });

      return true;
    } catch (error) {
      // Silently keep existing prices on error; the return value lets
      // callers know the quotes they asked for may be missing.
      return false;
    }
  },
}));

/**
 * Live price map for the given network. Returns a stable empty map when the
 * network has no cached prices yet. Use this instead of reading the raw store
 * so consumers never see another network's prices.
 */
export const usePricesForNetwork = (network: NETWORKS): TokenPricesMap =>
  usePricesStore((state) => state.pricesByNetwork[network] ?? EMPTY_PRICES);
