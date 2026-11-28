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

const keyFor = (publicKey: string, network: NETWORKS) =>
  `${publicKey}:${network}`;

interface PositionsState {
  /** The account and network the positions below belong to. */
  fetchedKey: string | null;
  positions: BlendPoolPosition[];
  /** A read for `fetchedKey` has succeeded at least once. */
  hasLoaded: boolean;
  isLoading: boolean;
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
    const key = keyFor(publicKey, network);

    // Another account's, or another network's, positions must never show
    // while this one's load.
    if (get().fetchedKey !== key) {
      set({ fetchedKey: key, positions: [], hasLoaded: false, error: null });
    }
    set({ isLoading: true });

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
    try {
      const pools = await getBlendPools({
        networkDetails: mapNetworkToNetworkDetails(network),
      });
      set({ pools, poolsNetwork: network });
    } catch (error) {
      logger.error("usePositionsStore", "Failed to fetch pools", error);
    }
  },

  fetchEarnOptions: async (network) => {
    try {
      const earnOptions = await getBlendEarnOptions({
        networkDetails: mapNetworkToNetworkDetails(network),
      });
      set({ earnOptions, earnOptionsNetwork: network });
    } catch (error) {
      logger.error("usePositionsStore", "Failed to fetch earn options", error);
    }
  },

  setAwaitedDeposit: (awaitedDeposit) => set({ awaitedDeposit }),

  reset: () => {
    positionsReadId += 1;
    set({ ...initialState });
  },
}));
