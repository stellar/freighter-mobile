import { Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import {
  DEFAULT_DECIMALS,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { useDebugStore } from "ducks/debug";
import { formatBigNumberForDisplay } from "helpers/formatAmount";
import { t } from "i18next";
import { getTokenForPayment } from "services/transactionService";
import { create } from "zustand";

export interface SwapPathResult {
  sourceAmount: string;
  destinationAmount: string;
  destinationAmountMin: string;
  path: string[];
  conversionRate: string;
}

interface HorizonPathToken {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface SwapPathData {
  sourceAmount: string;
  destinationAmount: string;
  path: string[];
  conversionRate: string;
}

interface SwapState {
  sourceTokenId: string;
  destinationTokenId: string;
  sourceTokenSymbol: string;
  destinationTokenSymbol: string;
  sourceAmount: string; // Internal value (dot notation)
  sourceAmountDisplay: string; // Display value (locale formatted)
  destinationAmount: string;
  pathResult: SwapPathResult | null;
  isLoadingPath: boolean;
  pathError: string | null;
  isBuilding: boolean;
  buildError: string | null;

  setSourceToken: (tokenId: string, tokenSymbol: string) => void;
  setDestinationToken: (tokenId: string, tokenSymbol: string) => void;
  setSourceAmount: (amount: string, preserveDisplay?: boolean) => void;
  setSourceAmountDisplay: (displayAmount: string) => void;
  findSwapPath: (params: {
    sourceBalance: PricedBalance;
    destinationBalance: PricedBalance;
    sourceAmount: string;
    slippage: number;
    network: NETWORKS;
    publicKey: string;
  }) => Promise<void>;
  clearPath: () => void;
  resetSwap: () => void;
}

const initialState = {
  sourceTokenId: "",
  destinationTokenId: "",
  sourceTokenSymbol: "",
  destinationTokenSymbol: "",
  sourceAmount: "0",
  sourceAmountDisplay: "0",
  destinationAmount: "0",
  pathResult: null,
  isLoadingPath: false,
  pathError: null,
  isBuilding: false,
  buildError: null,
};

const computeDestMinWithSlippage = (
  destinationAmount: string,
  slippage: number,
): string => {
  const mult = 1 - slippage / 100;
  return new BigNumber(destinationAmount).times(new BigNumber(mult)).toFixed(7);
};

/**
 * Finds the best swap path using Horizon's strict send paths endpoint
 * This is for classic token swaps using Stellar's built-in DEX
 */
const findClassicSwapPath = async (params: {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount: string;
  network: NETWORKS;
}): Promise<SwapPathData | null> => {
  const { sourceBalance, destinationBalance, sourceAmount, network } = params;

  try {
    const networkDetails = mapNetworkToNetworkDetails(network);
    const server = new Horizon.Server(networkDetails.networkUrl);

    const sourceToken = getTokenForPayment(sourceBalance);
    const destToken = getTokenForPayment(destinationBalance);

    const pathsResult = await server
      .strictSendPaths(sourceToken, sourceAmount, [destToken])
      .limit(1)
      .call();

    if (pathsResult.records.length === 0) {
      return null;
    }

    const bestPath = pathsResult.records[0];

    const path: string[] = bestPath.path.map((token: HorizonPathToken) => {
      if (token.asset_type === "native") {
        return "native";
      }
      return `${token.asset_code}:${token.asset_issuer}`;
    });

    const sourceAmountBN = new BigNumber(sourceAmount);
    const destAmountBN = new BigNumber(bestPath.destination_amount);
    const conversionRate = destAmountBN.dividedBy(sourceAmountBN).toFixed(7);

    return {
      sourceAmount,
      destinationAmount: bestPath.destination_amount,
      path,
      conversionRate,
    };
  } catch (error) {
    logger.error("SwapStore", "Failed to find classic swap path", error);
    throw error;
  }
};

export const useSwapStore = create<SwapState>((set) => ({
  ...initialState,

  setSourceToken: (tokenId, tokenSymbol) =>
    set({ sourceTokenId: tokenId, sourceTokenSymbol: tokenSymbol }),

  setDestinationToken: (tokenId, tokenSymbol) =>
    set({ destinationTokenId: tokenId, destinationTokenSymbol: tokenSymbol }),

  setSourceAmount: (amount, preserveDisplay = false) => {
    // Expect internal dot notation input, convert to display format
    if (!preserveDisplay) {
      const displayAmount = formatBigNumberForDisplay(new BigNumber(amount), {
        decimalPlaces: DEFAULT_DECIMALS,
      });
      set({ sourceAmount: amount, sourceAmountDisplay: displayAmount });
    } else {
      set({ sourceAmount: amount });
    }
  },

  setSourceAmountDisplay: (displayAmount) => {
    // Update only the display value, preserve internal value
    set({ sourceAmountDisplay: displayAmount });
  },

  findSwapPath: async (params) => {
    const {
      sourceBalance,
      destinationBalance,
      sourceAmount,
      slippage,
      network,
    } = params;

    set({ isLoadingPath: true, pathError: null, pathResult: null });

    try {
      const { forceSwapPathFailure } = useDebugStore.getState();

      if (forceSwapPathFailure) {
        throw new Error(t("debug.debugMessages.swapPathFailure"));
      }

      // For now, we only support classic path payments
      // TODO: Add Soroswap support for Testnet in future iteration
      const pathResult = await findClassicSwapPath({
        sourceBalance,
        destinationBalance,
        sourceAmount,
        network,
      });

      if (!pathResult) {
        set({
          isLoadingPath: false,
          pathError: t("swapScreen.errors.noPathFound"),
        });
        return;
      }

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

      logger.error("SwapStore", "Failed to find swap path", error);

      // In dev mode, show the actual error; otherwise show generic message
      const displayError = __DEV__
        ? errorMessage
        : t("swapScreen.errors.pathFindFailed");

      set({
        isLoadingPath: false,
        pathError: displayError,
      });
    }
  },

  clearPath: () =>
    set({
      pathResult: null,
      destinationAmount: "0",
      pathError: null,
    }),

  resetSwap: () => set(initialState),
}));
