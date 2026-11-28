import { AwaitedDeposit } from "components/screens/PositionsScreen/helpers/awaitedDeposit";
import {
  BlendCatalogPool,
  BlendEarnAssetOption,
  BlendPoolPosition,
} from "config/blendTypes";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import {
  getBlendEarnOptions,
  getBlendPools,
  getBlendPositions,
} from "services/blend";
import { create } from "zustand";

/**
 * Numbers every positions read, so only the one started last may write: a
 * slow read of older positions can never put them back over newer ones.
 */
let positionsReadId = 0;

/**
 * The network each catalog read in flight is for, so the screens that all
 * keep Positions fresh (Home, and a pool or token screen over it) never
 * request the same catalog twice at once.
 */
const catalogReadsInFlight: {
  pools: NETWORKS | null;
  earnOptions: NETWORKS | null;
} = { pools: null, earnOptions: null };

/** The account and network a positions read belongs to. */
export const positionsKeyFor = (publicKey: string, network: NETWORKS) =>
  `${publicKey}:${network}`;

interface PositionsState {
  /** The account and network the positions below belong to. */
  fetchedKey: string | null;
  positions: BlendPoolPosition[];
  /** A read for `fetchedKey` has succeeded at least once. */
  hasLoaded: boolean;
  isLoading: boolean;
  /**
   * When the last read for `fetchedKey` started, in epoch ms; 0 before any.
   * Refreshes time themselves from it, so coming back to a screen never
   * reads again sooner than the refresh interval.
   */
  lastReadStartedAt: number;
  /**
   * Set only while nothing good is there to show: a failed refresh keeps the
   * last positions on screen instead.
   */
  error: string | null;
  /** The pool catalog, for a token's Deposit; null until read. */
  pools: BlendCatalogPool[] | null;
  poolsNetwork: NETWORKS | null;
  /** The earn catalog, for the empty tab's "Earn up to"; null until read. */
  earnOptions: BlendEarnAssetOption[] | null;
  earnOptionsNetwork: NETWORKS | null;
  /** A deposit Home is waiting to see (see `AwaitedDeposit`). */
  awaitedDeposit: AwaitedDeposit | null;

  fetchPositions: (params: {
    publicKey: string;
    network: NETWORKS;
  }) => Promise<BlendPoolPosition[] | null>;
  fetchPools: (network: NETWORKS) => Promise<void>;
  fetchEarnOptions: (network: NETWORKS) => Promise<void>;
  setAwaitedDeposit: (awaitedDeposit: AwaitedDeposit | null) => void;
  reset: () => void;
}

const initialState = {
  fetchedKey: null,
  positions: [],
  hasLoaded: false,
  isLoading: false,
  lastReadStartedAt: 0,
  error: null,
  pools: null,
  poolsNetwork: null,
  earnOptions: null,
  earnOptionsNetwork: null,
  awaitedDeposit: null,
};

/**
 * Home's Blend positions: the Positions tab and the pool and token screens it
 * opens all read them from here, so a refresh updates every one of them.
 */
export const usePositionsStore = create<PositionsState>()((set, get) => ({
  ...initialState,

  fetchPositions: async ({ publicKey, network }) => {
    positionsReadId += 1;
    const readId = positionsReadId;
    const key = positionsKeyFor(publicKey, network);

    // Another account's, or another network's, positions must never show
    // while this one's load.
    if (get().fetchedKey !== key) {
      set({ fetchedKey: key, positions: [], hasLoaded: false, error: null });
    }
    set({ isLoading: true, lastReadStartedAt: Date.now() });

    try {
      const { positions } = await getBlendPositions({
        publicKey,
        networkDetails: mapNetworkToNetworkDetails(network),
      });
      if (readId !== positionsReadId) {
        return null;
      }
      set({ positions, hasLoaded: true, isLoading: false, error: null });
      return positions;
    } catch (error) {
      if (readId !== positionsReadId) {
        return null;
      }
      logger.error("usePositionsStore", "Failed to fetch positions", error);
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        isLoading: false,
        error: state.hasLoaded ? null : message,
      }));
      return null;
    }
  },

  fetchPools: async (network) => {
    if (catalogReadsInFlight.pools === network) {
      return;
    }
    catalogReadsInFlight.pools = network;
    try {
      const pools = await getBlendPools({
        networkDetails: mapNetworkToNetworkDetails(network),
      });
      set({ pools, poolsNetwork: network });
    } catch (error) {
      logger.error("usePositionsStore", "Failed to fetch pools", error);
    } finally {
      if (catalogReadsInFlight.pools === network) {
        catalogReadsInFlight.pools = null;
      }
    }
  },

  fetchEarnOptions: async (network) => {
    if (catalogReadsInFlight.earnOptions === network) {
      return;
    }
    catalogReadsInFlight.earnOptions = network;
    try {
      const earnOptions = await getBlendEarnOptions({
        networkDetails: mapNetworkToNetworkDetails(network),
      });
      set({ earnOptions, earnOptionsNetwork: network });
    } catch (error) {
      logger.error("usePositionsStore", "Failed to fetch earn options", error);
    } finally {
      if (catalogReadsInFlight.earnOptions === network) {
        catalogReadsInFlight.earnOptions = null;
      }
    }
  },

  setAwaitedDeposit: (awaitedDeposit) => set({ awaitedDeposit }),

  reset: () => {
    positionsReadId += 1;
    catalogReadsInFlight.pools = null;
    catalogReadsInFlight.earnOptions = null;
    set({ ...initialState });
  },
}));
