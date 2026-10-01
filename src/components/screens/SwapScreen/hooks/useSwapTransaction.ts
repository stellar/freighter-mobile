import Blockaid from "@blockaid/client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import {
  getQuoteExpiredOperationCodes,
  getTokenFromBalance,
  isStaleAggregatorQuote,
  isAggregatorQuoteSource,
  reportSettledSwap,
  resolveDestinationDisplayPrice,
  withDescriptorPrice,
} from "components/screens/SwapScreen/helpers";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import {
  SWAP_ROUTES,
  SwapStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { PricedBalance, NativeToken, NonNativeToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useHistoryStore } from "ducks/history";
import { usePricesStore } from "ducks/prices";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { SwapPathResult, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import {
  SubmitResultCodes,
  SubmitTransactionOutcome,
  useTransactionBuilderStore,
} from "ducks/transactionBuilder";
import { formatTokenIdentifier, getTokenIdentifier } from "helpers/balances";
import {
  ConfirmationSnapshotHandle,
  startConfirmationPriceSnapshot,
} from "helpers/confirmationPriceSnapshot";
import {
  AssetIdentity,
  canonicalIdFromIdentity,
  classifyAssetIdentity,
  deriveLegUsd,
  getFailureCategory,
  pickReasonCode,
} from "helpers/usdVolume";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { isWalletUnlocked } from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";
import { FailureVolume } from "services/analytics/types";
import { SecurityLevel } from "services/blockaid/constants";
import { assessTransactionSecurity } from "services/blockaid/helper";

/**
 * `destinationTokenInput` is either the user's held PricedBalance for
 * the destination, or a `descriptorAsPathBalance(descriptor)` shim for
 * non-held destinations. `buildSwapTransaction` only reads the `token`
 * shape (code/issuer/type) plus `tokenCode` off the value, so the shim
 * is structurally sufficient; do not treat it as a real holding.
 */
interface SwapTransactionParams {
  sourceAmount: string;
  sourceBalance: PricedBalance | undefined;
  destinationTokenInput: PricedBalance | undefined;
  pathResult: SwapPathResult | null;
  account: ActiveAccount | null;
  network: NETWORKS;
  navigation: NativeStackNavigationProp<
    SwapStackParamList,
    typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
  >;
}

export interface SwapReview {
  scanResult: Blockaid.StellarTransactionScanResponse | undefined;
  quote: SwapPathResult;
  transactionXDR: string;
  requestId: string | null;
  identity: string;
}

interface UseSwapTransactionResult {
  isProcessing: boolean;
  executeSwap: (review: SwapReview) => Promise<void>;
  /**
   * Builds + scans the swap transaction. Returns the fresh transaction scan
   * result so callers can decide the post-scan UX (e.g. the unable-to-scan
   * gate) without reading the lagging `transactionScanResult` render state.
   * `scanResult` is undefined when the scan fails (treated as unable-to-scan).
   * Returns undefined only when required params are missing (no build).
   */
  setupSwapTransaction: () => Promise<SwapReview | void>;
  handleProcessingScreenClose: () => void;
  sourceToken: NativeToken | NonNativeToken;
  destinationToken: NativeToken | NonNativeToken;
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
}

/**
 * Quotes the swap again in place, with the current slippage and timeout settings.
 * Resolves to the quote now in the store: a failed refresh leaves the previous
 * quote there (or none), so callers compare it with the one they held. A silent
 * refresh does not show as loading on the amount screen.
 */
const requote = async ({
  sourceBalance,
  destinationBalance,
  sourceAmount,
  network,
  publicKey,
  silent = true,
}: {
  sourceBalance: PricedBalance;
  destinationBalance: PricedBalance;
  sourceAmount: string;
  network: NETWORKS;
  publicKey: string;
  silent?: boolean;
}): Promise<SwapPathResult | null> => {
  const { swapSlippage, swapTimeout } = useSwapSettingsStore.getState();
  await useSwapStore.getState().findSwapPath({
    sourceBalance,
    destinationBalance,
    sourceAmount,
    slippage: swapSlippage,
    timeoutSeconds: swapTimeout,
    network,
    publicKey,
    silent,
  });

  return useSwapStore.getState().pathResult;
};

/** A submit failure, carrying what the terminal event classifies it by. */
type SubmitFailure = Error & {
  quoteExpiredCodes?: string[];
  resultCodes?: SubmitResultCodes | null;
  httpStatus?: number | null;
  isProtocolAnswer?: boolean;
};

/**
 * Builds the error thrown for a rejected submit, carrying the attempt's own
 * result codes, HTTP status and protocol-answer flag so the catch reports the
 * real reason instead of falling back to `unknown` / `transport`.
 */
const toSubmitFailure = (
  message: string,
  outcome: SubmitTransactionOutcome,
): SubmitFailure => {
  const failure: SubmitFailure = new Error(message);
  failure.resultCodes = outcome.resultCodes;
  failure.httpStatus = outcome.httpStatus;
  failure.isProtocolAnswer = outcome.isProtocolAnswer;

  return failure;
};

/**
 * Records that the swap's trustline is on chain. The event carries the asset the
 * user added, read from the swap store's destination.
 */
const trackTrustlineAdded = (assetCode: string): void => {
  const { destinationToken } = useSwapStore.getState();
  if (destinationToken?.requiresTrustline) {
    analytics.track(AnalyticsEvent.SWAP_TRUSTLINE_ADDED, {
      asset_code: assetCode,
      asset_issuer: destinationToken.issuer ?? "",
    });
  }
};

/** Trustline-first swap scan levels that block the swap, and the error text key of each. */
const BLOCKED_SWAP_ERROR_KEYS: Partial<
  Record<
    SecurityLevel,
    | "swapScreen.errors.trustlineAddedSwapMalicious"
    | "swapScreen.errors.trustlineAddedSwapSuspicious"
  >
> = {
  [SecurityLevel.MALICIOUS]: "swapScreen.errors.trustlineAddedSwapMalicious",
  [SecurityLevel.SUSPICIOUS]: "swapScreen.errors.trustlineAddedSwapSuspicious",
};

export const useSwapTransaction = ({
  sourceAmount,
  sourceBalance,
  destinationTokenInput,
  pathResult,
  account,
  network,
  navigation,
}: SwapTransactionParams): UseSwapTransactionResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionScanResult, setTransactionScanResult] =
    useState<UseSwapTransactionResult["transactionScanResult"]>(undefined);
  const {
    buildSwapTransaction,
    buildTrustlineTransaction,
    prepareAggregatorSwap,
    signTransaction,
    submitTransaction,
  } = useTransactionBuilderStore();
  const { fetchAccountHistory } = useHistoryStore();
  const { scanTransaction } = useBlockaidTransaction();
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const swapAttemptRef = useRef(0);
  const preparedReviewRef = useRef<SwapReview | null>(null);
  const identityRef = useRef({
    publicKey: account?.publicKey,
    network,
    sourceAmount,
  });
  identityRef.current = {
    publicKey: account?.publicKey,
    network,
    sourceAmount,
  };
  const getReviewIdentity = useCallback(() => {
    const selection = useSwapStore.getState();
    const settings = useSwapSettingsStore.getState();
    return JSON.stringify([
      identityRef.current,
      selection.sourceTokenId,
      selection.sourceAmount,
      selection.destinationToken?.id,
      selection.destinationToken?.decimals,
      selection.inputSide,
      selection.destinationInputAmount,
      settings.swapFee,
      settings.swapSlippage,
      settings.swapTimeout,
    ]);
  }, []);
  useEffect(
    () => () => {
      swapAttemptRef.current += 1;
    },
    [],
  );

  // Latest source/destination balances, read at call time by the quote-expired
  // refetch. Keeps executeSwap's deps on the stable `?.tokenCode` (not the full
  // objects, which get a new ref on every balance poll) so the callback — and
  // the review-sheet footer downstream — don't churn. findSwapPath only reads
  // token identity off these, so a one-render lag is harmless.
  const swapBalancesRef = useRef({ sourceBalance, destinationTokenInput });
  useEffect(() => {
    swapBalancesRef.current = { sourceBalance, destinationTokenInput };
  }, [sourceBalance, destinationTokenInput]);

  const scanSafely = useCallback(
    async (xdr: string) => {
      try {
        return await scanTransaction(xdr, "internal");
      } catch (error) {
        logger.error("SwapTransaction", "Transaction scan failed", error);

        return undefined;
      }
    },
    [scanTransaction],
  );

  const setupSwapTransaction = useCallback(async () => {
    preparedReviewRef.current = null;
    const identity = getReviewIdentity();
    if (
      !sourceBalance ||
      !destinationTokenInput ||
      !pathResult ||
      !account?.publicKey
    ) {
      return undefined;
    }

    // Get fresh settings values each time the function is called
    const { swapFee: freshSwapFee, swapTimeout: freshSwapTimeout } =
      useSwapSettingsStore.getState();
    const selection = useSwapStore.getState();
    const selectionIsCurrent = () => {
      const current = useSwapStore.getState();
      return (
        current.sourceTokenId === selection.sourceTokenId &&
        current.sourceAmount === selection.sourceAmount &&
        current.destinationToken?.id === selection.destinationToken?.id
      );
    };

    // An aggregator transaction expires and its simulation ages, so a quote
    // that sat on the amount screen is refreshed before it is verified.
    let quote = pathResult;
    if (isStaleAggregatorQuote(quote)) {
      const refreshed = await requote({
        sourceBalance,
        destinationBalance: destinationTokenInput,
        sourceAmount,
        network,
        publicKey: account.publicKey,
      });
      if (!refreshed || !selectionIsCurrent()) return undefined;
      quote = refreshed;
    }
    if (!new BigNumber(quote.sourceAmount).eq(sourceAmount)) return undefined;

    // Derive includeTrustline from the swap store's destinationToken.
    // When requiresTrustline === true the user doesn't yet hold a trustline for the
    // destination asset; the changeTrust op is prepended atomically.
    const { destinationToken } = useSwapStore.getState();
    let includeTrustline: { tokenCode: string; issuer: string } | undefined;
    if (destinationToken?.requiresTrustline) {
      if (!destinationToken.issuer) {
        // Unreachable in practice: native XLM can't be requiresTrustline, and the picker
        // filters out Soroban. Fail fast so the bug surfaces here rather than
        // submitting a doomed transaction that fails on-chain with tx_no_trust.
        throw new Error(
          `useSwapTransaction: requiresTrustline=true but issuer missing on destinationToken (id=${destinationToken.id})`,
        );
      }
      includeTrustline = {
        tokenCode: destinationToken.tokenCode,
        issuer: destinationToken.issuer,
      };
    }

    let transactionXDR: string | null;
    if (isAggregatorQuoteSource(quote.source)) {
      // A Soroban swap is a single operation, so a missing trustline is opened
      // by a transaction of its own first; the swap is prepared after it lands.
      transactionXDR =
        quote.requiresTrustlineFirst && includeTrustline
          ? await buildTrustlineTransaction({
              ...includeTrustline,
              transactionFee: freshSwapFee,
              transactionTimeout: freshSwapTimeout,
              network,
              senderAddress: account.publicKey,
            })
          : prepareAggregatorSwap({
              transaction: quote.aggregatorTransaction,
            });
    } else {
      transactionXDR = await buildSwapTransaction({
        sourceAmount,
        sourceBalance,
        destinationBalance: destinationTokenInput,
        path: quote.path,
        destinationAmount: quote.destinationAmount,
        destinationAmountMin: quote.destinationAmountMin,
        transactionFee: freshSwapFee,
        transactionTimeout: freshSwapTimeout,
        network,
        senderAddress: account.publicKey,
        includeTrustline,
      });
    }

    if (!transactionXDR) {
      // The builder stored and logged the error; users see the translated message.
      const { error: builderError } = useTransactionBuilderStore.getState();
      throw new Error(
        __DEV__
          ? builderError || "Failed to build swap transaction"
          : t("swapScreen.errors.failedToSetupTransaction"),
      );
    }

    // A failed scan is undefined, which classifies as unable-to-scan downstream.
    const { requestId } = useTransactionBuilderStore.getState();
    const scanResult = await scanSafely(transactionXDR);
    const builder = useTransactionBuilderStore.getState();
    if (
      !selectionIsCurrent() ||
      useSwapStore.getState().pathResult !== quote ||
      getReviewIdentity() !== identity ||
      builder.requestId !== requestId ||
      builder.transactionXDR !== transactionXDR
    )
      return undefined;
    setTransactionScanResult(scanResult);

    const review = { scanResult, quote, transactionXDR, requestId, identity };
    preparedReviewRef.current = review;
    return review;
  }, [
    sourceBalance,
    destinationTokenInput,
    pathResult,
    buildSwapTransaction,
    buildTrustlineTransaction,
    prepareAggregatorSwap,
    account?.publicKey,
    sourceAmount,
    network,
    scanSafely,
    getReviewIdentity,
    t,
  ]);

  const executeSwap = useCallback(
    async (review: SwapReview) => {
      if (!review || preparedReviewRef.current !== review) return;
      if (!account) {
        return;
      }

      // Validate required data before proceeding
      if (!sourceBalance?.tokenCode) {
        throw new Error("Source token is required for swap transaction");
      }

      if (!destinationTokenInput?.tokenCode) {
        throw new Error("Destination token is required for swap transaction");
      }

      swapAttemptRef.current += 1;
      const attempt = swapAttemptRef.current;
      let builderRequestId = review.requestId;
      let builderXdr: string | null = review.transactionXDR;
      if (
        getReviewIdentity() !== review.identity ||
        useSwapStore.getState().pathResult !== review.quote ||
        useTransactionBuilderStore.getState().requestId !== builderRequestId ||
        useTransactionBuilderStore.getState().transactionXDR !== builderXdr
      )
        return;
      preparedReviewRef.current = null;

      const isCurrentAttempt = () => swapAttemptRef.current === attempt;
      const isCurrentTransaction = () =>
        isCurrentAttempt() &&
        getReviewIdentity() === review.identity &&
        useTransactionBuilderStore.getState().requestId === builderRequestId &&
        useTransactionBuilderStore.getState().transactionXDR === builderXdr;
      const cancelStaleAttempt = () => {
        if (isCurrentTransaction()) return false;
        if (isCurrentAttempt()) setIsProcessing(false);
        return true;
      };
      setIsProcessing(true);

      // Declared outside the try so the catch can cancel a snapshot whose
      // transaction never reached submission, and can still enrich a
      // post-submission failure's telemetry with the identities it classified.
      let snapshotHandle: ConfirmationSnapshotHandle | null = null;
      // Only a submitted transaction has attempted volume to report, so the
      // catch reads this to decide whether the failure event carries volume
      // data or just its pre-existing failure properties.
      let didSubmit = false;
      let sourceIdentity: AssetIdentity | null = null;
      let destIdentity: AssetIdentity | null = null;
      let sourceCanonicalId = "";
      let destCanonicalId = "";

      // A lock cancels quietly. A signing failure reaches this flow's single
      // failure handler below, without attempted volume.
      const signOrThrow = (secretKey: string): string | null => {
        // Signing reads the global builder: a closed or replaced flow must not
        // sign another transaction after its asynchronous scan finishes.
        if (cancelStaleAttempt()) return null;
        if (!isWalletUnlocked()) {
          setIsProcessing(false);
          return null;
        }
        const expiresAt =
          useTransactionBuilderStore.getState().transactionExpiresAt;
        if (expiresAt != null && expiresAt <= Date.now() / 1000 + 20) {
          throw new Error(t("swapScreen.errors.quoteExpired"));
        }
        const signedXDR = signTransaction({ secretKey, network });
        if (!signedXDR) {
          const { error: signingError } = useTransactionBuilderStore.getState();
          analytics.trackInternalSignedTransactionError(signingError);
          throw new Error(signingError || "Failed to sign transaction");
        }
        analytics.trackInternalSignedTransaction();

        return signedXDR;
      };

      try {
        // Abort cleanly if an auto-lock engaged after the swap was prepared.
        // Return (don't throw): being locked isn't a swap failure, so skip the
        // catch's analytics + error-toast path — a hard-coded throw would also
        // surface as a non-localized toast title. A return (not a throw) keeps
        // the fire-and-forget executeSwap() from rejecting unhandled.
        if (!isWalletUnlocked()) {
          setIsProcessing(false);
          return;
        }

        // Read the freshest balances at call time via the ref (not the
        // closure, which is stale for anything besides tokenCode — see the
        // comment on swapBalancesRef above) for classification and the
        // cached-display-price fallback: `currentPrice` changes on every price
        // poll without recreating this callback. Always defined in practice —
        // the ref is seeded from this same hook's props and re-synced on every
        // render — but narrowed explicitly rather than asserted.
        const { sourceBalance: freshSource, destinationTokenInput: freshDest } =
          swapBalancesRef.current;
        if (!freshSource || !freshDest) {
          setIsProcessing(false);
          return;
        }

        const networkDetails = mapNetworkToNetworkDetails(network);

        // Aggregator swap into an asset the account has no trustline for: the
        // built transaction is the trustline. Send it, then swap.
        const quotedPath = useSwapStore.getState().pathResult;
        if (quotedPath?.requiresTrustlineFirst && account.publicKey) {
          if (!signOrThrow(account.privateKey)) return;
          // An intermediate step: its hash must not reach the store, or the
          // processing screen reports the swap as settled on the trustline.
          // `didSubmit` stays false, so a failure here carries no volume.
          const trustlineOutcome = await submitTransaction({
            network,
            isIntermediate: true,
          });
          if (!trustlineOutcome.hash) {
            // submitTransaction has logged the detail.
            throw toSubmitFailure(
              __DEV__
                ? trustlineOutcome.error ||
                    "Failed to submit trustline transaction"
                : t("swapScreen.errors.trustlineSubmitFailed"),
              trustlineOutcome,
            );
          }
          // The trustline is on chain whatever becomes of the swap, so it is
          // reported now and not again when the swap settles.
          trackTrustlineAdded(destinationTokenInput.tokenCode);
          if (cancelStaleAttempt()) return;

          // The trustline exists now, so the aggregator can simulate the swap.
          const swapPath = await requote({
            sourceBalance: freshSource,
            destinationBalance: freshDest,
            sourceAmount,
            network,
            publicKey: account.publicKey,
          });
          if (cancelStaleAttempt()) return;
          if (
            !swapPath ||
            swapPath === quotedPath ||
            !isAggregatorQuoteSource(swapPath.source) ||
            !swapPath.aggregatorTransaction?.envelopeXdr
          ) {
            throw new Error(
              t("swapScreen.errors.trustlineAddedSwapUnavailable"),
            );
          }
          if (
            new BigNumber(swapPath.destinationAmountMin).isLessThan(
              quotedPath.destinationAmountMin,
            )
          ) {
            throw new Error(t("swapScreen.errors.trustlineAddedPriceMoved"));
          }
          const swapXdr = prepareAggregatorSwap({
            transaction: swapPath.aggregatorTransaction,
          });
          if (!isCurrentAttempt()) return;
          builderRequestId = useTransactionBuilderStore.getState().requestId;
          builderXdr = swapXdr;
          if (!swapXdr) {
            const { error: verifyError } =
              useTransactionBuilderStore.getState();
            // prepareAggregatorSwap has logged the detail.
            throw new Error(
              __DEV__
                ? verifyError || "Failed to prepare swap transaction"
                : t("swapScreen.errors.prepareSwapFailed"),
            );
          }

          // The review scanned the trustline transaction, not this swap, so the
          // swap envelope gets its own scan before it is signed. Same scan call
          // as the review; a failed scan is unable-to-scan, which proceeds as it
          // does in the single-transaction flow.
          const swapScanResult = await scanSafely(swapXdr);
          if (cancelStaleAttempt()) return;
          const swapSecurityLevel =
            assessTransactionSecurity(swapScanResult).level;
          const blockedKey = BLOCKED_SWAP_ERROR_KEYS[swapSecurityLevel];
          if (blockedKey) {
            logger.warn(
              "SwapTransaction",
              `Blocked the swap after the trustline: the swap transaction scan is ${swapSecurityLevel.toLowerCase()}`,
            );
            throw new Error(t(blockedKey));
          }
        }

        const signedXDR = signOrThrow(account.privateKey);
        if (!signedXDR) return;
        // The quoted destination amount of the transaction just signed: a
        // trustline-first flow re-quoted in place, so the store holds its quote.
        const signedDestinationAmount =
          useSwapStore.getState().pathResult?.destinationAmount;

        // Everything the volume telemetry needs is snapshotted here — after
        // signing succeeded and immediately before submission, so the prices
        // are as close as possible to the transaction's actual execution time.
        // Amounts and prices are frozen together and carried to whichever
        // terminal event fires. Both legs' canonical ids go into ONE price
        // request, so they're priced at the same instant. Starting it only once
        // signing has succeeded also means a signing failure never issues a
        // price request it would just have to abort.
        const heldBalances = Object.values(
          useBalancesStore.getState().balances,
        );
        const { tokenCode: srcCode, issuer: srcIssuerRaw } =
          formatTokenIdentifier(getTokenIdentifier(freshSource));
        sourceIdentity = classifyAssetIdentity(
          srcCode,
          srcIssuerRaw || undefined,
          networkDetails,
          heldBalances,
        );
        const { tokenCode: dstCode, issuer: dstIssuerRaw } =
          formatTokenIdentifier(getTokenIdentifier(freshDest));
        destIdentity = classifyAssetIdentity(
          dstCode,
          dstIssuerRaw || undefined,
          networkDetails,
          heldBalances,
        );
        sourceCanonicalId = canonicalIdFromIdentity(sourceIdentity);
        destCanonicalId = canonicalIdFromIdentity(destIdentity);

        // The snapshot's cached_display fallback records the price the user
        // saw. The source is a held balance: its own price, else the prices
        // store. The destination may be a non-held shim with no `currentPrice`,
        // so it is priced the way the receive card prices it (balance, prices
        // store, the picker's price, the catalog's), by the same helper.
        const displayPrices =
          usePricesStore.getState().pricesByNetwork[network] ?? {};
        const destinationDescriptor = useSwapStore.getState().destinationToken;
        const destinationDisplayPrice = resolveDestinationDisplayPrice({
          balance: freshDest,
          prices: withDescriptorPrice(displayPrices, destinationDescriptor),
          descriptor: destinationDescriptor,
        });

        snapshotHandle = startConfirmationPriceSnapshot({
          canonicalIds: [sourceCanonicalId, destCanonicalId],
          network,
          useV2: useRemoteConfigStore.getState().use_token_prices_v2,
          cachedDisplayPrices: {
            [sourceCanonicalId]: {
              currentPrice:
                freshSource.currentPrice ??
                displayPrices[sourceCanonicalId]?.currentPrice ??
                null,
            },
            [destCanonicalId]: {
              currentPrice: destinationDisplayPrice ?? null,
            },
          },
        });

        // Read before the await: closing the processing screen mid-submit
        // unmounts the swap screen, whose cleanup resets the swap settings to
        // their defaults. Reading afterwards would report the default tolerance
        // rather than the one this swap was actually built with.
        const { swapSlippage: freshSwapSlippage } =
          useSwapSettingsStore.getState();

        // submitTransaction throws only for a debug override; otherwise it
        // resolves with this attempt's own outcome. That outcome is read from
        // the return value, never from the store: closing the processing screen
        // mid-submit resets the store, and the store's requestId guard then
        // (correctly) refuses to write this attempt's result — so the terminal
        // event would otherwise report a settled swap as a derivation error, or
        // a Horizon rejection as `unknown` / `transport`.
        const submitOutcome = await submitTransaction({ network });
        // Set only once the call has returned. A throw out of submitTransaction
        // itself (the debug forced-failure override) never reached the network,
        // so it carries no attempted volume and must not be bucketed as
        // `transport` — which means "submitted, but no verdict came back". A
        // genuine submit failure resolves rather than throwing, so it still
        // counts as submitted, as it should.
        didSubmit = true;

        if (!submitOutcome.hash) {
          const errorMessage =
            submitOutcome.error || "Failed to submit transaction";
          const submitFailure = toSubmitFailure(errorMessage, submitOutcome);
          submitFailure.quoteExpiredCodes = getQuoteExpiredOperationCodes(
            submitOutcome.resultCodes,
          );
          throw submitFailure;
        }

        // Prices are frozen at the moment the swap settled, not when the
        // settled amount has been read.
        const snapshot = snapshotHandle.resolve();

        // Receipt enrichment is detached; success, balances and navigation never await it.
        reportSettledSwap({
          outcome: submitOutcome,
          signedXDR,
          network,
          destination: freshDest,
          publicKey: account.publicKey,
          snapshot,
          sourceAmount,
          sourceCanonicalId,
          destCanonicalId,
          sourceIdentity,
          destIdentity,
          sourceToken: sourceBalance.tokenCode,
          destToken: destinationTokenInput.tokenCode,
          quotedDestinationAmount: signedDestinationAmount,
          allowedSlippage: freshSwapSlippage?.toString(),
        });

        // Fire SWAP_TRUSTLINE_ADDED when the combined changeTrust +
        // pathPaymentStrictSend transaction confirmed a new trustline. A
        // trustline sent ahead of the swap reported itself when it landed.
        if (!quotedPath?.requiresTrustlineFirst) {
          trackTrustlineAdded(destinationTokenInput.tokenCode);
        }
      } catch (error) {
        if (isCurrentAttempt()) setIsProcessing(false);
        // transactionBuilder.submitTransaction logs submit failures at
        // the appropriate severity (4xx-with-result_codes → warn
        // breadcrumb, everything else → logger.error). Re-logging here
        // would either duplicate Sentry events or pollute breadcrumbs.

        // Carried on the thrown error, off this attempt's own submit outcome —
        // not read back from the store, which a mid-submit Close resets.
        const submitFailure =
          error instanceof Error ? (error as SubmitFailure) : undefined;
        const quoteExpiredCodes = submitFailure?.quoteExpiredCodes;
        const isQuoteExpired = !!quoteExpiredCodes?.length;
        const submitResultCodes = submitFailure?.resultCodes ?? undefined;

        // A pre-submission failure (signing, or a throw before submit) still
        // emits swap.failed, but with no volume data: nothing reached the
        // network, so there is no attempted volume and no snapshot to price it
        // with. Cancel the fetch rather than let it outlive the flow.
        const reasonCode = pickReasonCode(submitResultCodes);
        let volume: FailureVolume | undefined;
        if (!didSubmit) {
          snapshotHandle?.cancel();
        } else if (snapshotHandle && sourceIdentity && destIdentity) {
          const snapshot = snapshotHandle.resolve();
          const sourceLeg = deriveLegUsd(
            sourceAmount,
            snapshot.pricesById?.[sourceCanonicalId]?.currentPrice,
          );
          volume = {
            identity: sourceIdentity,
            toIdentity: destIdentity,
            amount: new BigNumber(sourceAmount || 0).toNumber(),
            sourceLeg,
            priceSource: snapshot.source,
            priceFreshness: snapshot.freshness,
            reasonCode,
            failureCategory: getFailureCategory(
              submitFailure?.isProtocolAnswer ?? false,
              submitFailure?.httpStatus ?? null,
              reasonCode,
            ),
          };
        }

        // Record the failed attempt once, including quote expiry rejections.
        analytics.trackTransactionError({
          error: error instanceof Error ? error.message : String(error),
          errorCode: reasonCode,
          isSwap: true,
          sourceToken: sourceBalance?.tokenCode,
          destToken: destinationTokenInput?.tokenCode,
          ...(isQuoteExpired
            ? {}
            : { sourceAmount, destAmount: pathResult?.destinationAmount }),
          volume,
        });
        if (isQuoteExpired) {
          analytics.track(AnalyticsEvent.SWAP_QUOTE_EXPIRED, {
            from_asset_code: sourceBalance?.tokenCode,
            to_asset_code: destinationTokenInput?.tokenCode,
            result_code: quoteExpiredCodes.join(", "),
          });
          if (!isCurrentTransaction()) return;

          showToast({
            variant: "error",
            title: t("swapScreen.errors.quoteExpired"),
            toastId: "swap-quote-expired",
            duration: 0,
          });

          // The frozen quote is stale — fetch a fresh path so the user's retry
          // uses a new quote instead of resubmitting the expired one.
          const {
            sourceBalance: latestSource,
            destinationTokenInput: latestDest,
          } = swapBalancesRef.current;
          if (latestSource && latestDest && account.publicKey) {
            // Fire-and-forget: findSwapPath updates the store and handles its own
            // errors (matches how useSwapPathFinding invokes it).
            requote({
              sourceBalance: latestSource,
              destinationBalance: latestDest,
              sourceAmount,
              network,
              publicKey: account.publicKey,
              silent: false,
            });
          }

          return;
        }

        if (!isCurrentTransaction()) return;

        // Show error toast that persists even if component unmounts
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("swapScreen.errors.swapTransactionFailed");

        showToast({
          variant: "error",
          title: errorMessage,
          toastId: "swap-transaction-failed",
          duration: 0,
        });

        // Don't rethrow - this catch is the terminal handler (toast,
        // analytics, isProcessing reset) and the only caller invokes
        // executeSwap() fire-and-forget. Rethrowing would surface as an
        // unhandled promise rejection at the global handler.
      }
    },
    [
      account,
      sourceBalance?.tokenCode,
      destinationTokenInput?.tokenCode,
      sourceAmount,
      pathResult?.destinationAmount,
      signTransaction,
      prepareAggregatorSwap,
      network,
      scanSafely,
      submitTransaction,
      t,
      showToast,
      getReviewIdentity,
    ],
  );

  const handleProcessingScreenClose = () => {
    preparedReviewRef.current = null;
    swapAttemptRef.current += 1;
    setIsProcessing(false);

    if (account?.publicKey) {
      fetchAccountHistory({
        publicKey: account.publicKey,
        network,
        isBackgroundRefresh: true,
        hasRecentTransaction: true,
      });
    }

    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with History tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
            index: 0,
          },
        },
      ],
    });
  };

  const sourceToken = getTokenFromBalance(sourceBalance);
  const destinationToken = getTokenFromBalance(destinationTokenInput);

  return {
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    sourceToken,
    destinationToken,
    transactionScanResult,
  };
};
