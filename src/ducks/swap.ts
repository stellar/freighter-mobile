import { Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers";
import {
  DEFAULT_DECIMALS,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { useDebugStore } from "ducks/debug";
import { isNativeAssetId } from "helpers/assetIdentity";
import {
  formatBigNumberForDisplay,
  getBalanceDecimals,
} from "helpers/formatAmount";
import { getSorobanContractId, swapAssetId } from "helpers/swapAssets";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { t } from "i18next";
import {
  isApiError,
  isRequestCanceled,
  logApiError,
} from "services/apiFactory";
import { SwapQuote, SwapQuoteSource, fetchSwapQuote } from "services/backend";
import { getTokenForPayment } from "services/transactionService";
import { create } from "zustand";

export interface SwapPathResult {
  sourceAmount: string;
  destinationAmount: string;
  destinationAmountMin: string;
  path: string[];
  conversionRate: string;
  /** The venue that quoted the route: the aggregator, or the classic DEX (`HORIZON`), whether the backend or the device lookup found it. */
  source: SwapQuoteSource;
  /** When the quote was taken, in ms. Aggregator transactions expire, so old quotes get refreshed. */
  quotedAt: number;
  /** Full fee, in XLM, of the aggregator transaction. Absent when the wallet builds the transaction. */
  networkFeeXlm?: string;
  /** Unsigned aggregator transaction. Absent for a classic route, or before the trustline exists. */
  aggregatorTransaction?: SwapQuote["transaction"];
  /** The aggregator route needs the destination trustline added in a first transaction. */
  requiresTrustlineFirst?: boolean;
}

interface HorizonPathToken {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

type SwapPathData = Omit<SwapPathResult, "quotedAt">;

/** The card the user last typed in; the quote is asked for that card's amount. */
export enum SwapInputSide {
  SOURCE = "source",
  DESTINATION = "destination",
}

interface SwapState {
  sourceTokenId: string;
  sourceTokenSymbol: string;
  destinationToken: DestinationTokenDescriptor | null;
  sourceAmount: string; // Internal value (dot notation)
  sourceAmountDisplay: string; // Display value (locale formatted)
  /**
   * Which card the user last typed in. The typed amount drives the quote and the
   * other card shows what the backend derived from it: the amount sold
   * (`sourceAmount`) when `SOURCE`, the amount to receive (`destinationInputAmount`)
   * when `DESTINATION`.
   */
  inputSide: SwapInputSide;
  destinationInputAmount: string; // Typed amount to receive (dot notation)
  destinationAmount: string;
  pathResult: SwapPathResult | null;
  isLoadingPath: boolean;
  pathError: string | null;
  isBuilding: boolean;
  buildError: string | null;

  setSourceToken: (tokenId: string, tokenSymbol: string) => void;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
  setSourceAmount: (amount: string, preserveDisplay?: boolean) => void;
  setSourceAmountDisplay: (displayAmount: string) => void;
  setInputSide: (side: SwapInputSide) => void;
  setDestinationInputAmount: (amount: string) => void;
  findSwapPath: (params: {
    sourceBalance: PricedBalance;
    destinationBalance: PricedBalance;
    /** What to sell. Exactly one of `sourceAmount` and `destinationAmount` is set. */
    sourceAmount?: string;
    /** What to receive; the backend sizes the amount to sell and it lands in `sourceAmount`. */
    destinationAmount?: string;
    slippage: number;
    /** How long, in seconds, an aggregator transaction stays valid. */
    timeoutSeconds: number;
    network: NETWORKS;
    publicKey: string;
    /** Refresh the quote in place: no loading state, and a failed refresh keeps the current quote. */
    silent?: boolean;
  }) => Promise<void>;
  /** Invalidate the quote; keep loading visible when its replacement is debouncing. */
  clearPath: (isLoadingPath?: boolean) => void;
  resetSwap: () => void;
}

const initialState = {
  sourceTokenId: "",
  sourceTokenSymbol: "",
  destinationToken: null as DestinationTokenDescriptor | null,
  sourceAmount: "0",
  sourceAmountDisplay: "0",
  inputSide: SwapInputSide.SOURCE,
  destinationInputAmount: "0",
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
  decimals = DEFAULT_DECIMALS,
): string => {
  const slippagePpm = Math.trunc(slippage * 10_000);
  return new BigNumber(destinationAmount)
    .times(1_000_000 - slippagePpm)
    .shiftedBy(-6)
    .toFixed(decimals, BigNumber.ROUND_DOWN);
};

/**
 * Finds the best swap path using Horizon's strict send paths endpoint
 * This is for classic token swaps using Stellar's built-in DEX
 */
const findClassicSwapPath = async (params: {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount: string;
  slippage: number;
  network: NETWORKS;
  signal: AbortSignal;
}): Promise<SwapPathData | null> => {
  const {
    sourceBalance,
    destinationBalance,
    sourceAmount,
    slippage,
    network,
    signal,
  } = params;

  const networkDetails = mapNetworkToNetworkDetails(network);
  const server = new Horizon.Server(networkDetails.networkUrl);
  server.httpClient.interceptors.request.use((config) => ({
    ...config,
    signal,
  }));

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
    if (isNativeAssetId(token.asset_type)) {
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
    destinationAmountMin: computeDestMinWithSlippage(
      bestPath.destination_amount,
      slippage,
    ),
    path,
    conversionRate,
    source: SwapQuoteSource.HORIZON,
  };
};

/**
 * Asks the backend for the best route across the classic DEX and the XOXNO
 * aggregator. Resolves to `null` when no route exists and to `undefined` when the
 * backend could not answer, so the caller can fall back to the device lookup.
 * A backend failure is logged as an error and a connectivity failure as a warning;
 * a quote whose decimals disagree with the wallet's is logged as an error and
 * treated as no answer.
 */
const findBackendSwapPath = async (params: {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount?: string;
  destinationAmount?: string;
  slippage: number;
  timeoutSeconds: number;
  network: NETWORKS;
  publicKey: string;
  signal: AbortSignal;
}): Promise<SwapPathData | null | undefined> => {
  let quote: SwapQuote;
  try {
    quote = await fetchSwapQuote({
      network: params.network,
      sourceAsset: swapAssetId(params.sourceBalance),
      destAsset: swapAssetId(params.destinationBalance),
      sourceDecimals: getBalanceDecimals(params.sourceBalance),
      destDecimals: getBalanceDecimals(params.destinationBalance),
      sourceAmount: params.sourceAmount,
      destAmount: params.destinationAmount,
      sender: params.publicKey,
      slippagePercent: params.slippage,
      timeoutSeconds: params.timeoutSeconds,
      signal: params.signal,
    });
  } catch (error) {
    if (params.signal.aborted) return undefined;
    if (isRequestCanceled(error)) throw error;
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    logApiError(
      "SwapStore",
      "Swap quote unreachable",
      "Swap quote request failed",
      error,
    );

    return undefined;
  }

  if (params.signal.aborted) return undefined;

  // The amounts are shown, and the transaction is checked, with the decimals the
  // wallet knows the token has, so a quote that disagrees is not trusted.
  const expectedDecimals = getBalanceDecimals(params.destinationBalance);
  if (quote.destinationDecimals !== expectedDecimals) {
    logger.error(
      "SwapStore",
      "Swap quote decimals differ from the token's",
      new Error(
        `${swapAssetId(params.destinationBalance)}: quoted ${quote.destinationDecimals}, expected ${expectedDecimals}`,
      ),
    );

    return undefined;
  }

  const [sourceAmount, destinationAmount, minimum] = [
    quote.sourceAmount,
    quote.destinationAmount,
    quote.destinationAmountMin,
  ].map(
    (amount) =>
      new BigNumber(
        typeof amount === "string" &&
        amount.length <= 40 &&
        /^\d+(?:\.\d+)?$/.test(amount)
          ? amount
          : NaN,
      ),
  );
  if (
    !Object.values(SwapQuoteSource).includes(quote.source) ||
    !sourceAmount.isFinite() ||
    !sourceAmount.gt(0) ||
    (sourceAmount.decimalPlaces() ?? Infinity) >
      getBalanceDecimals(params.sourceBalance) ||
    (params.sourceAmount !== undefined &&
      !sourceAmount.eq(params.sourceAmount)) ||
    !destinationAmount.isFinite() ||
    !destinationAmount.gt(0) ||
    (destinationAmount.decimalPlaces() ?? Infinity) > expectedDecimals ||
    !minimum.isFinite() ||
    minimum.lt(0) ||
    (minimum.decimalPlaces() ?? Infinity) > expectedDecimals ||
    minimum.gt(destinationAmount) ||
    minimum.lt(
      computeDestMinWithSlippage(
        quote.destinationAmount,
        params.slippage,
        expectedDecimals,
      ),
    )
  ) {
    logger.error(
      "SwapStore",
      "Swap quote amounts do not match the request",
      new Error("Invalid swap quote amounts or venue"),
    );
    return undefined;
  }

  return {
    sourceAmount: quote.sourceAmount,
    destinationAmount: quote.destinationAmount,
    destinationAmountMin: quote.destinationAmountMin,
    path: quote.path ?? [],
    conversionRate: quote.conversionRate,
    source: quote.source,
    networkFeeXlm: quote.networkFeeXlm,
    aggregatorTransaction: quote.transaction
      ? { ...quote.transaction }
      : undefined,
    requiresTrustlineFirst: quote.requiresTrustline,
  };
};

let latestPathRequest = 0;
let activePathController: AbortController | undefined;

export const useSwapStore = create<SwapState>((set, get) => ({
  ...initialState,

  setSourceToken: (tokenId, tokenSymbol) => {
    const changed = tokenId !== get().sourceTokenId;
    if (changed) get().clearPath();
    set({
      sourceTokenId: tokenId,
      sourceTokenSymbol: tokenSymbol,
      ...(changed && {
        // Reset the amount on an actual source-token change. Centralized
        // here so every caller is correct by construction: otherwise the
        // prior amount (e.g. the old token's Max) is briefly validated
        // against the new token's possibly-smaller balance before the
        // converter's reset-on-token-change lands, flashing an
        // "Insufficient balance" error. Skipped when the token is
        // unchanged so a re-pick doesn't wipe an in-progress amount.
        sourceAmount: "0",
        sourceAmountDisplay: "0",
      }),
    });
  },

  setDestinationToken: (descriptor) => {
    const current = get().destinationToken;
    if (
      descriptor?.id !== current?.id ||
      descriptor?.decimals !== current?.decimals
    ) {
      get().clearPath();
    }
    set({ destinationToken: descriptor });
  },

  setSourceAmount: (amount, preserveDisplay = false) => {
    if (amount !== get().sourceAmount) get().clearPath();
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

  setInputSide: (side) => {
    if (side === get().inputSide) return;
    set({ inputSide: side });
    get().clearPath();
  },

  setDestinationInputAmount: (amount) => {
    if (amount !== get().destinationInputAmount) get().clearPath();
    set({ destinationInputAmount: amount });
  },

  setSourceAmountDisplay: (displayAmount) => {
    // Update only the display value, preserve internal value
    set({ sourceAmountDisplay: displayAmount });
  },

  findSwapPath: async (params) => {
    const requestId = ++latestPathRequest;
    activePathController?.abort();
    const controller = new AbortController();
    activePathController = controller;
    const {
      sourceBalance,
      destinationBalance,
      sourceAmount,
      destinationAmount: wantedDestinationAmount,
      slippage,
      network,
      silent,
    } = params;
    const isExactOut = wantedDestinationAmount !== undefined;

    if (!silent) {
      set({ isLoadingPath: true, pathError: null, pathResult: null });
    }

    const failPath = (message: string) => {
      if (requestId !== latestPathRequest) return;

      set({
        isLoadingPath: false,
        ...(!silent && {
          pathError: __DEV__ ? message : t("swapScreen.errors.pathFindFailed"),
        }),
      });
    };

    try {
      const { forceSwapPathFailure } = useDebugStore.getState();

      if (forceSwapPathFailure) {
        throw new Error(t("debug.debugMessages.swapPathFailure"));
      }

      const backendPath = await findBackendSwapPath({
        ...params,
        signal: controller.signal,
      });
      if (requestId !== latestPathRequest || controller.signal.aborted) return;
      if (
        backendPath === undefined &&
        (isExactOut ||
          getSorobanContractId(sourceBalance) ||
          getSorobanContractId(destinationBalance))
      ) {
        // Only the backend can size an input for a wanted output or route a
        // Soroban token; Horizon knows classic assets alone. Already logged.
        failPath("Swap quote unavailable");

        return;
      }
      const pathResult =
        backendPath === undefined
          ? await findClassicSwapPath({
              sourceBalance,
              destinationBalance,
              sourceAmount: sourceAmount ?? "0",
              slippage,
              network,
              signal: controller.signal,
            })
          : backendPath;
      if (requestId !== latestPathRequest || controller.signal.aborted) return;

      if (!pathResult) {
        set({
          isLoadingPath: false,
          ...(!silent && {
            pathError: t("swapScreen.errors.noPathFound"),
          }),
        });
        return;
      }

      const finalPathResult: SwapPathResult = {
        ...pathResult,
        quotedAt: Date.now(),
      };

      set({
        isLoadingPath: false,
        pathResult: finalPathResult,
        destinationAmount: pathResult.destinationAmount,
        ...(isExactOut && {
          sourceAmount: pathResult.sourceAmount,
          sourceAmountDisplay: formatBigNumberForDisplay(
            new BigNumber(pathResult.sourceAmount),
            { decimalPlaces: getBalanceDecimals(sourceBalance) },
          ),
        }),
      });
    } catch (error) {
      if (requestId !== latestPathRequest || controller.signal.aborted) return;
      if (isRequestCanceled(error)) {
        set({ isLoadingPath: false });
        return;
      }
      logger.error("SwapStore", "Failed to find swap path", error);

      failPath(error instanceof Error ? error.message : String(error));
    } finally {
      if (activePathController === controller) activePathController = undefined;
    }
  },

  clearPath: (isLoadingPath = false) => {
    latestPathRequest += 1;
    activePathController?.abort();
    activePathController = undefined;
    set((state) => ({
      pathResult: null,
      destinationAmount: "0",
      pathError: null,
      isLoadingPath,
      // The amount to sell is derived from the typed amount to receive, so it
      // goes with the quote.
      ...(state.inputSide === SwapInputSide.DESTINATION && {
        sourceAmount: "0",
        sourceAmountDisplay: "0",
      }),
    }));
  },

  resetSwap: () => {
    latestPathRequest += 1;
    activePathController?.abort();
    activePathController = undefined;
    set(initialState);
  },
}));

/**
 * Shim that lets a `DestinationTokenDescriptor` flow through the
 * path-finding / transaction-building pipelines where they accept a
 * `PricedBalance`. The pipelines only read `token` (code/issuer/type)
 * off the value; the `as unknown as PricedBalance` cast is safe here
 * because of that read-shape contract. Don't treat the shim as a real
 * holding anywhere else.
 *
 * Native XLM is unreachable: XLM is the user's reserve, always present
 * in `balanceItems`, so the SwapAmountScreen useMemo at the call site
 * resolves `destinationBalance` to the held XLM PricedBalance before
 * this shim is reached. We assert that invariant rather than silently
 * mint a fake.
 */
export const descriptorAsPathBalance = (
  descriptor: DestinationTokenDescriptor,
): HeldBalanceItem => {
  if (descriptor.tokenType === TokenTypeWithCustomToken.NATIVE) {
    throw new Error(
      `descriptorAsPathBalance: native descriptor (id=${descriptor.id}) — XLM should always resolve to a held balance before this shim runs`,
    );
  }

  if (!descriptor.issuer) {
    throw new Error(
      `descriptorAsPathBalance: non-native descriptor missing issuer (id=${descriptor.id})`,
    );
  }

  return {
    id: descriptor.id,
    tokenCode: descriptor.tokenCode,
    tokenType: descriptor.tokenType,
    token: {
      code: descriptor.tokenCode,
      issuer: { key: descriptor.issuer },
      type: descriptor.tokenType,
    },
    // A Soroban token declares its own decimals; a classic one is left without
    // them, which is how the amount converter tells the two apart.
    ...(descriptor.tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN && {
      contractId: descriptor.issuer,
      symbol: descriptor.tokenCode,
      decimals: descriptor.decimals,
    }),
  } as unknown as HeldBalanceItem;
};

/**
 * An aggregator transaction expires and its simulation ages, so a quote older
 * than this is refreshed when the review sheet opens.
 */
export const AGGREGATOR_QUOTE_MAX_AGE_MS = 20_000;

/** Sources whose executable quote is an unsigned Soroban envelope. */
export const isAggregatorQuoteSource = (source: SwapQuoteSource): boolean =>
  source === SwapQuoteSource.XOXNO || source === SwapQuoteSource.LIFI;

/** Aggregator quotes go stale; classic ones are built at review time and do not. */
export const isStaleAggregatorQuote = (pathResult: SwapPathResult): boolean =>
  isAggregatorQuoteSource(pathResult.source) &&
  !pathResult.requiresTrustlineFirst &&
  (Date.now() - pathResult.quotedAt > AGGREGATOR_QUOTE_MAX_AGE_MS ||
    !pathResult.aggregatorTransaction?.feeStroops ||
    !pathResult.aggregatorTransaction?.resourceFeeStroops ||
    !Number.isSafeInteger(pathResult.aggregatorTransaction?.expiresAt) ||
    (pathResult.aggregatorTransaction?.expiresAt ?? 0) <=
      Date.now() / 1000 + 20);
