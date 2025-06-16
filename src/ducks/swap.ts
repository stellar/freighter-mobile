import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { create } from "zustand";

/**
 * SwapPathResult Interface
 *
 * Represents the result of a path finding operation for swaps.
 */
export interface SwapPathResult {
  sourceAmount: string;
  destinationAmount: string;
  destinationAmountMin: string; // After slippage
  path: string[];
  conversionRate: string;
  isPathPayment: boolean; // true for classic path payments, false for direct swaps
}

/**
 * SwapState Interface
 *
 * Defines the structure of the swap state store using Zustand.
 * This store manages swap-specific state including token selection,
 * amounts, path finding, and transaction building.
 */
interface SwapState {
  // Token selection
  fromTokenId: string;
  toTokenId: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;

  // Amount state
  swapAmount: string;
  destinationAmount: string;

  // Path finding state
  pathResult: SwapPathResult | null;
  isLoadingPath: boolean;
  pathError: string | null;

  // Transaction state
  isBuilding: boolean;
  buildError: string | null;

  // Actions
  setFromToken: (tokenId: string, tokenSymbol: string) => void;
  setToToken: (tokenId: string, tokenSymbol: string) => void;
  setSwapAmount: (amount: string) => void;
  findSwapPath: (params: {
    fromBalance: PricedBalance;
    toBalance: PricedBalance;
    amount: string;
    slippage: number;
    network: NETWORKS;
    publicKey: string;
  }) => Promise<void>;
  clearPath: () => void;
  resetSwap: () => void;
}

const initialState = {
  fromTokenId: "",
  toTokenId: "",
  fromTokenSymbol: "",
  toTokenSymbol: "",
  swapAmount: "0",
  destinationAmount: "0",
  pathResult: null,
  isLoadingPath: false,
  pathError: null,
  isBuilding: false,
  buildError: null,
};

/**
 * Calculates minimum received amount after slippage
 */
const computeDestMinWithSlippage = (
  amount: string,
  slippage: number,
): string => {
  const mult = 1 - slippage / 100;
  return new BigNumber(amount).times(new BigNumber(mult)).toFixed(7);
};

/**
 * Finds the best swap path using Horizon's strict send paths endpoint
 * This is for classic asset swaps using Stellar's built-in DEX
 */
const findClassicSwapPath = async (params: {
  fromBalance: PricedBalance;
  toBalance: PricedBalance;
  amount: string;
  network: NETWORKS;
}): Promise<SwapPathResult | null> => {
  const { fromBalance, toBalance, amount, network } = params;

  try {
    // Import Stellar SDK dynamically to avoid circular dependencies
    const { Asset, Horizon } = await import("@stellar/stellar-sdk");
    const { mapNetworkToNetworkDetails } = await import("config/constants");
    const { getAssetForPayment } = await import("services/transactionService");

    const networkDetails = mapNetworkToNetworkDetails(network);
    const server = new Horizon.Server(networkDetails.networkUrl);

    const sourceAsset = getAssetForPayment(fromBalance);
    const destAsset = getAssetForPayment(toBalance);

    // Use Horizon's strict send paths to find the best path
    const pathsResult = await server
      .strictSendPaths(sourceAsset, amount, [destAsset])
      .limit(1)
      .call();

    if (pathsResult.records.length === 0) {
      return null;
    }

    const bestPath = pathsResult.records[0];
    
    // Build path array (intermediate assets)
    const path: string[] = bestPath.path.map((asset: any) => {
      if (asset.asset_type === "native") {
        return "native";
      }
      return `${asset.asset_code}:${asset.asset_issuer}`;
    });

    // Calculate conversion rate
    const sourceAmountBN = new BigNumber(amount);
    const destAmountBN = new BigNumber(bestPath.destination_amount);
    const conversionRate = destAmountBN.dividedBy(sourceAmountBN).toFixed(7);

    return {
      sourceAmount: amount,
      destinationAmount: bestPath.destination_amount,
      destinationAmountMin: bestPath.destination_amount, // Will be adjusted for slippage later
      path,
      conversionRate,
      isPathPayment: path.length > 0 || !sourceAsset.equals(destAsset),
    };
  } catch (error) {
    logger.error("SwapStore", "Failed to find classic swap path", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Swap Store
 *
 * A Zustand store that manages swap state and operations.
 */
export const useSwapStore = create<SwapState>((set, get) => ({
  ...initialState,

  /**
   * Sets the source token for the swap
   */
  setFromToken: (tokenId, tokenSymbol) =>
    set({ fromTokenId: tokenId, fromTokenSymbol: tokenSymbol }),

  /**
   * Sets the destination token for the swap
   */
  setToToken: (tokenId, tokenSymbol) =>
    set({ toTokenId: tokenId, toTokenSymbol: tokenSymbol }),

  /**
   * Sets the swap amount
   */
  setSwapAmount: (amount) => set({ swapAmount: amount }),

  /**
   * Finds the best swap path between two tokens
   */
  findSwapPath: async (params) => {
    const { fromBalance, toBalance, amount, slippage, network, publicKey } = params;

    set({ isLoadingPath: true, pathError: null, pathResult: null });

    try {
      // For now, we only support classic path payments
      // TODO: Add Soroswap support for Testnet in future iteration
      const pathResult = await findClassicSwapPath({
        fromBalance,
        toBalance,
        amount,
        network,
      });

      if (!pathResult) {
        set({
          isLoadingPath: false,
          pathError: "No swap path found between these assets",
        });
        return;
      }

      // Apply slippage to destination amount
      const destinationAmountMin = computeDestMinWithSlippage(
        pathResult.destinationAmount,
        slippage,
      );

      const finalPathResult: SwapPathResult = {
        ...pathResult,
        destinationAmountMin,
      };

      set({
        isLoadingPath: false,
        pathResult: finalPathResult,
        destinationAmount: pathResult.destinationAmount,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("SwapStore", "Failed to find swap path", {
        error: errorMessage,
      });

      set({
        isLoadingPath: false,
        pathError: errorMessage,
      });
    }
  },

  /**
   * Clears the current path result
   */
  clearPath: () =>
    set({
      pathResult: null,
      destinationAmount: "0",
      pathError: null,
    }),

  /**
   * Resets the entire swap state
   */
  resetSwap: () => set(initialState),
})); 