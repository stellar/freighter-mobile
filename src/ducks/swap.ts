import BigNumber from "bignumber.js";
import {
  DestinationTokenDescriptor,
  missingSwapRouteReason,
  selectSwapRoute,
  swapQuoteErrorReason,
} from "components/screens/SwapScreen/helpers";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import { logger } from "config/logger";
import {
  PricedBalance,
  SwapQuotes,
  SwapRoute,
  TokenTypeWithCustomToken,
} from "config/types";
import { useDebugStore } from "ducks/debug";
import { formatBigNumberForDisplay } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { t } from "i18next";
import { fetchSwapQuotes } from "services/backend";
import { getTokenForPayment } from "services/transactionService";
import { create } from "zustand";

export interface SwapPathResult {
  sourceAmount: string;
  destinationAmount: string;
  /** The quoted route `/swap/tx` builds */
  route: SwapRoute;
  conversionRate: string;
  /** `swapQuoteKey` of the inputs this quote answered. */
  quoteKey: string;
}

interface SwapState {
  sourceTokenId: string;
  sourceTokenSymbol: string;
  /**
   * Where the swap flow was entered from (e.g. "token_details"), carried
   * onto the swap.completed analytics event as `source`. null for the
   * default (home) entry; reset with the rest of the swap state on unmount.
   */
  entrySource: string | null;
  destinationToken: DestinationTokenDescriptor | null;
  sourceAmount: string; // Internal value (dot notation)
  sourceAmountDisplay: string; // Display value (locale formatted)
  destinationAmount: string;
  pathResult: SwapPathResult | null;
  /** Every route and unavailable source from the last quote, for the route list. */
  swapQuotes: SwapQuotes | null;
  isLoadingPath: boolean;
  pathError: string | null;
  /** `swapQuoteKey` of the inputs `pathError` is for. */
  pathErrorQuoteKey: string | null;
  isBuilding: boolean;
  buildError: string | null;

  setSourceToken: (tokenId: string, tokenSymbol: string) => void;
  setEntrySource: (entrySource: string | null) => void;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
  setSourceAmount: (amount: string, preserveDisplay?: boolean) => void;
  setSourceAmountDisplay: (displayAmount: string) => void;
  findSwapPath: (params: {
    sourceBalance: PricedBalance;
    destinationBalance: PricedBalance;
    sourceAmount: string;
    network: NETWORKS;
    publicKey: string;
  }) => Promise<void>;
  clearPath: () => void;
  resetSwap: () => void;
}

const initialState = {
  sourceTokenId: "",
  sourceTokenSymbol: "",
  entrySource: null as string | null,
  destinationToken: null as DestinationTokenDescriptor | null,
  sourceAmount: "0",
  sourceAmountDisplay: "0",
  destinationAmount: "0",
  pathResult: null,
  swapQuotes: null as SwapQuotes | null,
  isLoadingPath: false,
  pathError: null,
  pathErrorQuoteKey: null as string | null,
  isBuilding: false,
  buildError: null,
};

/**
 * The minOut sent to `/swap/tx`: exact decimal arithmetic, rounded down to
 * 7 dp. LI.FI's min_amount_out is truncated, so rounding up here can exceed
 * it by a stroop and turn every build into a 409.
 */
export const swapMinOut = (toAmount: string, slippage: number): string =>
  new BigNumber(toAmount)
    .times(new BigNumber(100).minus(slippage))
    .div(100)
    .toFixed(7, BigNumber.ROUND_DOWN);

export const toSwapWireAsset = (balance: PricedBalance): string => {
  const token = getTokenForPayment(balance);
  return token.isNative()
    ? NATIVE_TOKEN_CODE
    : `${token.getCode()}:${token.getIssuer()}`;
};

interface SwapQuoteInputs {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount: string;
  network: NETWORKS;
  publicKey: string;
}

const sendQuoteRequest = (inputs: SwapQuoteInputs) => ({
  network: inputs.network,
  account: inputs.publicKey,
  mode: "send" as const,
  fromAsset: toSwapWireAsset(inputs.sourceBalance),
  toAsset: toSwapWireAsset(inputs.destinationBalance),
  // The backend accepts only plain decimals; the store can hold "5." or "1e-7".
  amount: new BigNumber(inputs.sourceAmount).toFixed(),
});

const quoteKeyOf = (r: ReturnType<typeof sendQuoteRequest>): string =>
  [r.account, r.network, r.mode, r.fromAsset, r.toAsset, r.amount].join("|");

/**
 * Identifies the send-quote request for these inputs. Review and build use
 * `pathResult` only when its `quoteKey` equals the key of the current inputs.
 * Null when the inputs can't be quoted.
 */
export const swapQuoteKey = (inputs: SwapQuoteInputs): string | null => {
  try {
    return quoteKeyOf(sendQuoteRequest(inputs));
  } catch {
    return null;
  }
};

const QUOTE_ERROR_KEYS = {
  unavailable: "swapScreen.errors.swapsUnavailable",
  noRoute: "swapScreen.errors.noPathFound",
} as const;

// Quotes can take seconds, so a slower earlier request must not overwrite a
// newer one or a cleared path.
let quoteRequestId = 0;
// The quote re-fires per debounced keystroke, so an outage is reported to
// Sentry once until a quote succeeds or the screen is left.
let outageReported = false;

export const useSwapStore = create<SwapState>((set) => ({
  ...initialState,

  setSourceToken: (tokenId, tokenSymbol) =>
    set((state) =>
      tokenId === state.sourceTokenId
        ? { sourceTokenId: tokenId, sourceTokenSymbol: tokenSymbol }
        : {
            sourceTokenId: tokenId,
            sourceTokenSymbol: tokenSymbol,
            // Reset the amount on an actual source-token change. Centralized
            // here so every caller is correct by construction: otherwise the
            // prior amount (e.g. the old token's Max) is briefly validated
            // against the new token's possibly-smaller balance before the
            // converter's reset-on-token-change lands, flashing an
            // "Insufficient balance" error. Skipped when the token is
            // unchanged so a re-pick doesn't wipe an in-progress amount.
            sourceAmount: "0",
            sourceAmountDisplay: "0",
          },
    ),

  setDestinationToken: (descriptor) => set({ destinationToken: descriptor }),

  setEntrySource: (entrySource) => set({ entrySource }),

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
    const { sourceBalance, destinationBalance, sourceAmount } = params;

    quoteRequestId += 1;
    const requestId = quoteRequestId;
    const isStale = () => requestId !== quoteRequestId;
    const pathErrorQuoteKey = swapQuoteKey(params);

    set({
      isLoadingPath: true,
      pathError: null,
      pathErrorQuoteKey: null,
      pathResult: null,
      swapQuotes: null,
    });

    try {
      const { forceSwapPathFailure } = useDebugStore.getState();

      if (forceSwapPathFailure) {
        throw new Error(t("debug.debugMessages.swapPathFailure"));
      }

      // Custom/Soroban tokens cannot be swapped via Horizon's classic DEX
      const isSourceCustom =
        "contractId" in sourceBalance ||
        ("id" in sourceBalance && isContractId(sourceBalance.id ?? ""));
      const isDestCustom =
        "contractId" in destinationBalance ||
        ("id" in destinationBalance &&
          isContractId(destinationBalance.id ?? ""));

      if (isSourceCustom || isDestCustom) {
        outageReported = false;
        set({
          isLoadingPath: false,
          destinationAmount: "0",
          pathError: t("swapScreen.errors.customTokenSwapNotSupported"),
          pathErrorQuoteKey,
        });
        return;
      }

      const request = sendQuoteRequest(params);
      const swapQuotes = await fetchSwapQuotes(request);

      if (isStale()) return;

      const route = selectSwapRoute(swapQuotes);

      if (!route) {
        const reason = missingSwapRouteReason(swapQuotes);
        if (reason === "unavailable") {
          if (!outageReported) {
            outageReported = true;
            logger.error(
              "SwapStore",
              "Swap source unavailable",
              swapQuotes.unavailable,
            );
          }
        } else {
          outageReported = false;
        }
        // The receive card renders destinationAmount directly: the previous
        // quote's amount stays while a new quote is in flight (as designed)
        // but must not sit next to a failure.
        set({
          isLoadingPath: false,
          swapQuotes,
          destinationAmount: "0",
          pathError: t(QUOTE_ERROR_KEYS[reason]),
          pathErrorQuoteKey,
        });
        return;
      }

      const pathResult: SwapPathResult = {
        sourceAmount,
        destinationAmount: route.toAmount,
        route,
        conversionRate: new BigNumber(route.toAmount)
          .dividedBy(new BigNumber(sourceAmount))
          .toFixed(7),
        quoteKey: quoteKeyOf(request),
      };

      outageReported = false;
      set({
        isLoadingPath: false,
        swapQuotes,
        pathResult,
        destinationAmount: route.toAmount,
      });
    } catch (error) {
      if (isStale()) return;

      const errorMessage =
        (error as { message?: string } | null)?.message ?? String(error);

      const reason = swapQuoteErrorReason(error);
      if (reason === "noRoute") {
        // A 400 is the request (bad input, an unfunded account), not a fault.
        outageReported = false;
        logger.warn("SwapStore", "Swap quote rejected", error);
      } else if (reason === "unavailable") {
        if (!outageReported) {
          outageReported = true;
          logger.error("SwapStore", "Failed to find swap path", error);
        }
      } else {
        logger.error("SwapStore", "Failed to find swap path", error);
      }
      const fallbackError = __DEV__
        ? errorMessage
        : t("swapScreen.errors.pathFindFailed");
      const displayError = reason ? t(QUOTE_ERROR_KEYS[reason]) : fallbackError;

      set({
        isLoadingPath: false,
        destinationAmount: "0",
        pathError: displayError,
        pathErrorQuoteKey,
      });
    }
  },

  clearPath: () => {
    quoteRequestId += 1;
    outageReported = false;
    set({
      pathResult: null,
      swapQuotes: null,
      destinationAmount: "0",
      pathError: null,
      pathErrorQuoteKey: null,
      isLoadingPath: false,
    });
  },

  resetSwap: () => {
    quoteRequestId += 1;
    outageReported = false;
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
  } as unknown as HeldBalanceItem;
};
