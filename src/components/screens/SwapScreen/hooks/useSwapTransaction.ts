import Blockaid from "@blockaid/client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import {
  getQuoteExpiredOperationCodes,
  getTokenFromBalance,
  SwapSetupAnswerError,
  swapQuoteErrorReason,
} from "components/screens/SwapScreen/helpers";
import { SwapTxMismatchError } from "components/screens/SwapScreen/helpers/decodeSwapTx";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import {
  SWAP_ROUTES,
  SwapStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import {
  PricedBalance,
  NativeToken,
  NonNativeToken,
  TokenIdentifier,
} from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useHistoryStore } from "ducks/history";
import { usePricesStore } from "ducks/prices";
import {
  SwapPathResult,
  swapMinOut,
  toSwapWireAsset,
  useSwapStore,
} from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import {
  SubmitResultCodes,
  useTransactionBuilderStore,
} from "ducks/transactionBuilder";
import { formatTokenIdentifier, getTokenIdentifier } from "helpers/balances";
import {
  ConfirmationSnapshotHandle,
  startConfirmationPriceSnapshot,
} from "helpers/confirmationPriceSnapshot";
import {
  findPathPaymentStrictSendIndex,
  getSettledPathPaymentStrictSendAmount,
} from "helpers/transactionResult";
import {
  AssetIdentity,
  canonicalIdFromIdentity,
  classifyAssetIdentity,
  computeExecutionSlippagePct,
  computeUsdSlippagePct,
  deriveLegUsd,
  getFailureCategory,
  LegUsdStatus,
  pickReasonCode,
} from "helpers/usdVolume";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { isWalletUnlocked } from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";
import { FailureVolume } from "services/analytics/types";
import { isApiError } from "services/apiFactory";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

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
  /** `swapQuoteKey` of the current inputs; `pathResult` must match it. */
  currentQuoteKey: string | null;
  account: ActiveAccount | null;
  network: NETWORKS;
  /** Per-op network recommendation; "" while unknown */
  recommendedFee: string;
  navigation: NativeStackNavigationProp<
    SwapStackParamList,
    typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
  >;
}

interface UseSwapTransactionResult {
  isProcessing: boolean;
  executeSwap: () => Promise<void>;
  /**
   * Builds + scans the swap transaction. Returns the fresh transaction scan
   * result so callers can decide the post-scan UX (e.g. the unable-to-scan
   * gate) without reading the lagging `transactionScanResult` render state.
   * `scanResult` is undefined when the scan fails (treated as unable-to-scan).
   * Returns undefined only when required params are missing (no build), and
   * `superseded` when the inputs, the settings or the stored transaction
   * changed while it ran: the caller must not open review on it.
   */
  setupSwapTransaction: () => Promise<
    | { scanResult: Blockaid.StellarTransactionScanResponse | undefined }
    | { superseded: true }
    | void
  >;
  handleProcessingScreenClose: () => void;
  sourceToken: NativeToken | NonNativeToken;
  destinationToken: NativeToken | NonNativeToken;
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
  /** The XDR `transactionScanResult` is for; review waits until it is current. */
  scannedTransactionXDR: string | undefined;
}

export const useSwapTransaction = ({
  sourceAmount,
  sourceBalance,
  destinationTokenInput,
  pathResult,
  currentQuoteKey,
  account,
  network,
  recommendedFee,
  navigation,
}: SwapTransactionParams): UseSwapTransactionResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scan, setScan] = useState<{
    xdr: string;
    result: Blockaid.StellarTransactionScanResponse | undefined;
  } | null>(null);
  const { buildSwapTransaction, signTransaction, submitTransaction } =
    useTransactionBuilderStore();
  const { fetchAccountHistory } = useHistoryStore();
  const { scanTransaction } = useBlockaidTransaction();
  const { t } = useAppTranslation();
  const { showToast } = useToast();

  // Latest source/destination balances, read at call time by the quote-expired
  // refetch. Keeps executeSwap's deps on the stable `?.tokenCode` (not the full
  // objects, which get a new ref on every balance poll) so the callback — and
  // the review-sheet footer downstream — don't churn. findSwapPath only reads
  // token identity off these, so a one-render lag is harmless.
  const swapBalancesRef = useRef({ sourceBalance, destinationTokenInput });
  useEffect(() => {
    swapBalancesRef.current = { sourceBalance, destinationTokenInput };
  }, [sourceBalance, destinationTokenInput]);

  // Read after the build's await, which can outlive an edit to the inputs.
  const currentQuoteKeyRef = useRef(currentQuoteKey);
  currentQuoteKeyRef.current = currentQuoteKey;

  // Re-quotes after the quote expired, so the user's retry uses a new quote
  // instead of the expired one. Fire-and-forget: findSwapPath updates the
  // store and handles its own errors (as useSwapPathFinding invokes it).
  const requote = useCallback(() => {
    const { sourceBalance: latestSource, destinationTokenInput: latestDest } =
      swapBalancesRef.current;
    if (latestSource && latestDest && account?.publicKey) {
      useSwapStore.getState().findSwapPath({
        sourceBalance: latestSource,
        destinationBalance: latestDest,
        sourceAmount,
        network,
        publicKey: account.publicKey,
      });
    }
  }, [account?.publicKey, sourceAmount, network]);

  const setupSwapTransaction = useCallback(async () => {
    if (
      !sourceBalance ||
      !destinationTokenInput ||
      !pathResult ||
      !account?.publicKey
    ) {
      return undefined;
    }

    if (pathResult.quoteKey !== currentQuoteKey) {
      throw new Error(t("swapScreen.errors.quoteExpired"));
    }

    // Get fresh settings values each time the function is called
    const {
      swapFee: freshSwapFee,
      swapTimeout: freshSwapTimeout,
      swapSlippage: freshSwapSlippage,
      feeManuallyChanged,
    } = useSwapSettingsStore.getState();
    const { route } = pathResult;
    // The stored default is recommended × op count, sized for a classic
    // build (changeTrust + path payment). A Soroban source builds one op and
    // charges the whole fee as inclusion, so it gets the per-op rate.
    const requestFee =
      !feeManuallyChanged && route.source !== "classic" && recommendedFee
        ? recommendedFee
        : freshSwapFee;

    const isStillCurrent = (xdr: string) => {
      const settings = useSwapSettingsStore.getState();
      return (
        currentQuoteKeyRef.current === pathResult.quoteKey &&
        settings.swapFee === freshSwapFee &&
        settings.swapTimeout === freshSwapTimeout &&
        settings.swapSlippage === freshSwapSlippage &&
        useTransactionBuilderStore.getState().transactionXDR === xdr
      );
    };

    let transactionXDR: string;
    try {
      ({ xdr: transactionXDR } = await buildSwapTransaction({
        request: {
          network,
          account: account.publicKey,
          source: route.source,
          fromAsset: toSwapWireAsset(sourceBalance),
          toAsset: toSwapWireAsset(destinationTokenInput),
          // The quote key holds the same plain decimal.
          amount: new BigNumber(sourceAmount).toFixed(),
          // Slippage isn't in the quote key; the settings sheet can change it
          // after quoting.
          minOut: swapMinOut(route.toAmount, freshSwapSlippage),
          slippage: new BigNumber(freshSwapSlippage).toFixed(),
          timeout: freshSwapTimeout,
          fee: new BigNumber(requestFee).toFixed(),
          // Only classic builds read them; the backend ignores them otherwise.
          paths: route.paths,
        },
        sourceBalance,
        destinationBalance: destinationTokenInput,
        destinationAmount: pathResult.destinationAmount,
      }));
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        analytics.track(AnalyticsEvent.SWAP_QUOTE_EXPIRED, {
          from_asset_code: sourceBalance.tokenCode,
          to_asset_code: destinationTokenInput.tokenCode,
          result_code: "quote_moved",
        });
        requote();
        throw new SwapSetupAnswerError(t("swapScreen.errors.quoteExpired"));
      }
      if (swapQuoteErrorReason(error) === "unavailable") {
        throw new Error(t("swapScreen.errors.swapsUnavailable"));
      }
      if (isApiError(error) && error.status === 400) {
        throw new SwapSetupAnswerError(
          t("swapScreen.errors.failedToSetupTransaction"),
        );
      }
      if (error instanceof SwapTxMismatchError) {
        throw new Error(t("swapScreen.errors.swapTransactionMismatch"));
      }
      throw error;
    }

    if (!isStillCurrent(transactionXDR)) return { superseded: true as const };

    let scanResult: Blockaid.StellarTransactionScanResponse | undefined;
    try {
      scanResult = await scanTransaction(transactionXDR, "internal");
    } catch (error) {
      logger.error("SwapTransaction", "Transaction scan failed", error);
      // Scan failed → undefined classifies as unable-to-scan downstream.
      scanResult = undefined;
    }
    if (!isStillCurrent(transactionXDR)) return { superseded: true as const };
    setScan({ xdr: transactionXDR, result: scanResult });
    return { scanResult };
  }, [
    sourceBalance,
    destinationTokenInput,
    pathResult,
    currentQuoteKey,
    buildSwapTransaction,
    account?.publicKey,
    sourceAmount,
    network,
    recommendedFee,
    scanTransaction,
    requote,
    t,
  ]);

  const executeSwap = useCallback(async () => {
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

    // Entry tag stamped by SwapAmountScreen (e.g. "token_details") so
    // swap.completed can be broken down by entry point (design §7.5).
    // Captured HERE, into the submission closure, like every other payload
    // field: SwapAmountScreen's unmount cleanup calls resetSwap(), so
    // navigating away during submission would clear it before success.
    const { entrySource } = useSwapStore.getState();

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

      const signedXDR = signTransaction({
        secretKey: account.privateKey,
        network,
      });

      if (!signedXDR) {
        // Pre-submit signing failure. Throw rather than return: the catch
        // below is this flow's single failure path — it emits swap.failed
        // (without volume data, since nothing reached the network) and shows
        // the error toast, exactly as it did before volume telemetry existed.
        const { error: signingError } = useTransactionBuilderStore.getState();
        // The signing action failed. The user already approved at the review
        // sheet, so this is a fault, not a decision.
        analytics.trackInternalSignedTransactionError(signingError);
        throw new Error(signingError || "Failed to sign transaction");
      }

      // A signature exists, so the signing action succeeded.
      analytics.trackInternalSignedTransaction();

      // Everything the volume telemetry needs is snapshotted here — after
      // signing succeeded and immediately before submission, so the prices
      // are as close as possible to the transaction's actual execution time.
      // Amounts and prices are frozen together and carried to whichever
      // terminal event fires. Both legs' canonical ids go into ONE price
      // request, so they're priced at the same instant. Starting it only once
      // signing has succeeded also means a signing failure never issues a
      // price request it would just have to abort.
      const heldBalances = Object.values(useBalancesStore.getState().balances);
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

      // A non-held destination arrives as the `descriptorAsPathBalance` shim,
      // which carries no `currentPrice` — the receive card's fiat line reads
      // the prices store instead (`useSwapTokenPrices`). Fall back to that
      // same map, keyed identically to `recordTokenId`, so the cached_display
      // snapshot records the price the user actually saw rather than
      // reporting the leg unpriced. Precedence matches computeDestinationFiat:
      // the balance's own price first, then the store.
      const displayPrices =
        usePricesStore.getState().pricesByNetwork[network] ?? {};
      const displayPriceFor = (
        balance: PricedBalance,
        canonicalId: TokenIdentifier,
      ) =>
        balance.currentPrice ??
        displayPrices[canonicalId]?.currentPrice ??
        null;

      snapshotHandle = startConfirmationPriceSnapshot({
        canonicalIds: [sourceCanonicalId, destCanonicalId],
        network,
        cachedDisplayPrices: {
          [sourceCanonicalId]: {
            currentPrice: displayPriceFor(freshSource, sourceCanonicalId),
          },
          [destCanonicalId]: {
            currentPrice: displayPriceFor(freshDest, destCanonicalId),
          },
        },
      });

      // Read before the await: closing the processing screen mid-submit
      // unmounts the swap screen, whose cleanup resets the swap settings to
      // their defaults. Reading afterwards would report the default tolerance
      // rather than the one this swap was actually built with.
      const { swapSlippage: freshSwapSlippage } =
        useSwapSettingsStore.getState();
      const addsTrustline =
        !!useTransactionBuilderStore.getState().swapReview?.addsTrustline;
      const { destinationToken: swappedDestination } = useSwapStore.getState();

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
        const submitFailure = new Error(errorMessage) as Error & {
          quoteExpiredCodes?: string[];
          resultCodes?: SubmitResultCodes | null;
          httpStatus?: number | null;
          isProtocolAnswer?: boolean;
        };
        submitFailure.quoteExpiredCodes = getQuoteExpiredOperationCodes(
          submitOutcome.resultCodes,
        );
        submitFailure.resultCodes = submitOutcome.resultCodes;
        submitFailure.httpStatus = submitOutcome.httpStatus;
        submitFailure.isProtocolAnswer = submitOutcome.isProtocolAnswer;
        throw submitFailure;
      }

      // Settled destination amount, read from the transaction result — never
      // the quote. Horizon's submit response carries `result_xdr`
      // synchronously, and it reaches us on the returned outcome, so an
      // unreadable read here is a genuine derivation failure (`error`) rather
      // than a "not observed" case.
      const submittedTx = TransactionBuilder.fromXdr(
        signedXDR,
        networkDetails.networkPassphrase,
      );
      const opIndex = findPathPaymentStrictSendIndex(submittedTx);
      const settledDestAmount = submitOutcome.resultXdr
        ? getSettledPathPaymentStrictSendAmount(
            submitOutcome.resultXdr,
            opIndex,
          )
        : null;

      const snapshot = snapshotHandle.resolve();
      const sourceLeg = deriveLegUsd(
        sourceAmount,
        snapshot.pricesById?.[sourceCanonicalId]?.currentPrice,
      );
      const destLeg =
        settledDestAmount !== null
          ? deriveLegUsd(
              settledDestAmount,
              snapshot.pricesById?.[destCanonicalId]?.currentPrice,
            )
          : null;

      const executionSlippagePct =
        settledDestAmount !== null
          ? computeExecutionSlippagePct(
              pathResult?.destinationAmount,
              settledDestAmount,
            )
          : undefined;
      const usdSlippagePct =
        sourceLeg.status === LegUsdStatus.OK &&
        destLeg?.status === LegUsdStatus.OK &&
        sourceLeg.value !== 0
          ? computeUsdSlippagePct(sourceLeg.unrounded, destLeg.unrounded)
          : undefined;

      analytics.trackSwapSuccess({
        sourceToken: sourceBalance.tokenCode,
        destToken: destinationTokenInput.tokenCode,
        sourceAmount,
        destAmount: pathResult?.destinationAmount,
        allowedSlippage: freshSwapSlippage?.toString(),
        isSwap: true,
        source: entrySource ?? undefined,
        volume: {
          identity: sourceIdentity,
          toIdentity: destIdentity,
          amount: new BigNumber(sourceAmount || 0).toNumber(),
          sourceLeg,
          priceSource: snapshot.source,
          priceFreshness: snapshot.freshness,
          ...(pathResult?.destinationAmount
            ? {
                toAmountQuoted: new BigNumber(
                  pathResult.destinationAmount,
                ).toNumber(),
              }
            : {}),
          ...(settledDestAmount !== null
            ? { toAmount: settledDestAmount.toNumber() }
            : {}),
          toAmountUsdStatus: destLeg?.status ?? LegUsdStatus.ERROR,
          ...(destLeg?.status === LegUsdStatus.OK
            ? { toAmountUsd: destLeg.value, toAmountUsdRate: destLeg.rate }
            : {}),
          ...(usdSlippagePct !== undefined ? { usdSlippagePct } : {}),
          ...(executionSlippagePct !== undefined
            ? { executionSlippagePct }
            : {}),
        },
      });

      if (addsTrustline) {
        analytics.track(AnalyticsEvent.SWAP_TRUSTLINE_ADDED, {
          asset_code: destinationTokenInput.tokenCode,
          asset_issuer: swappedDestination?.issuer ?? "",
        });
      }
    } catch (error) {
      setIsProcessing(false);
      // transactionBuilder.submitTransaction logs submit failures at
      // the appropriate severity (4xx-with-result_codes → warn
      // breadcrumb, everything else → logger.error). Re-logging here
      // would either duplicate Sentry events or pollute breadcrumbs.

      const quoteExpiredCodes =
        error instanceof Error
          ? (error as Error & { quoteExpiredCodes?: string[] })
              .quoteExpiredCodes
          : undefined;
      const isQuoteExpired = !!quoteExpiredCodes?.length;

      // Carried on the thrown error, off this attempt's own submit outcome —
      // not read back from the store, which a mid-submit Close resets.
      const submitFailure =
        error instanceof Error
          ? (error as Error & {
              resultCodes?: SubmitResultCodes | null;
              httpStatus?: number | null;
              isProtocolAnswer?: boolean;
            })
          : undefined;
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

      if (isQuoteExpired) {
        // Over-slippage / liquidity-changed rejection: fire the dedicated
        // event alongside SWAP_FAIL (emitted just below — the pair is
        // deliberate, see there) and prompt the user to retry for a fresh
        // quote. `resultCode` carries the Horizon op code(s) that drove the
        // expiry so we can slice by reason.
        // Amounts intentionally dropped (parity with swap.completed/failed,
        // which carry no amounts). Bare asset codes so from/to_asset_code match
        // the extension.
        analytics.track(AnalyticsEvent.SWAP_QUOTE_EXPIRED, {
          from_asset_code: sourceBalance?.tokenCode,
          to_asset_code: destinationTokenInput?.tokenCode,
          result_code: quoteExpiredCodes.join(", "),
        });

        // A quote expiry rejected at submit also counts as a failed swap for
        // volume purposes: swap.quote_expired carries no volume, and without
        // this, the failure that `failure_category` exists to measure never
        // reaches a volume-bearing event. failure_category: "slippage" falls
        // out of the same reason-code mapping used for every other
        // rejection, so no special case is needed beyond emitting here too.
        // Only swap.failed carries volume, so the pair cannot double-count.
        analytics.trackTransactionError({
          error: error instanceof Error ? error.message : String(error),
          errorCode: reasonCode,
          isSwap: true,
          sourceToken: sourceBalance?.tokenCode,
          destToken: destinationTokenInput?.tokenCode,
          volume,
        });

        showToast({
          variant: "error",
          title: t("swapScreen.errors.quoteExpired"),
          toastId: "swap-quote-expired",
          duration: 0,
        });

        requote();

        return;
      }

      analytics.trackTransactionError({
        error: error instanceof Error ? error.message : String(error),
        errorCode: reasonCode,
        isSwap: true,
        sourceToken: sourceBalance?.tokenCode,
        destToken: destinationTokenInput?.tokenCode,
        sourceAmount,
        destAmount: pathResult?.destinationAmount,
        volume,
      });

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
  }, [
    account,
    sourceBalance?.tokenCode,
    destinationTokenInput?.tokenCode,
    sourceAmount,
    pathResult?.destinationAmount,
    signTransaction,
    network,
    submitTransaction,
    requote,
    t,
    showToast,
  ]);

  const handleProcessingScreenClose = () => {
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
    transactionScanResult: scan?.result,
    scannedTransactionXDR: scan?.xdr,
  };
};
