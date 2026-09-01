import Blockaid from "@blockaid/client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import {
  getQuoteExpiredOperationCodes,
  getTokenFromBalance,
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
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { SwapPathResult, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
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

interface UseSwapTransactionResult {
  isProcessing: boolean;
  executeSwap: () => Promise<void>;
  /**
   * Builds + scans the swap transaction. Returns the fresh transaction scan
   * result so callers can decide the post-scan UX (e.g. the unable-to-scan
   * gate) without reading the lagging `transactionScanResult` render state.
   * `scanResult` is undefined when the scan fails (treated as unable-to-scan).
   * Returns undefined only when required params are missing (no build).
   */
  setupSwapTransaction: () => Promise<{
    scanResult: Blockaid.StellarTransactionScanResponse | undefined;
  } | void>;
  handleProcessingScreenClose: () => void;
  sourceToken: NativeToken | NonNativeToken;
  destinationToken: NativeToken | NonNativeToken;
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
}

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

  const setupSwapTransaction = useCallback(async () => {
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

    const transactionXDR = await buildSwapTransaction({
      sourceAmount,
      sourceBalance,
      destinationBalance: destinationTokenInput,
      path: pathResult.path,
      destinationAmount: pathResult.destinationAmount,
      destinationAmountMin: pathResult.destinationAmountMin,
      transactionFee: freshSwapFee,
      transactionTimeout: freshSwapTimeout,
      network,
      senderAddress: account.publicKey,
      includeTrustline,
    });

    if (!transactionXDR) {
      // Get the error message stored in the transaction builder
      const { error: builderError } = useTransactionBuilderStore.getState();
      throw new Error(builderError || "Failed to build swap transaction");
    }
    try {
      const scanResult = await scanTransaction(transactionXDR, "internal");
      setTransactionScanResult(scanResult);
      return { scanResult };
    } catch (error) {
      logger.error("SwapTransaction", "Transaction scan failed", error);
      // Scan failed → undefined classifies as unable-to-scan downstream.
      setTransactionScanResult(undefined);
      return { scanResult: undefined };
    }
  }, [
    sourceBalance,
    destinationTokenInput,
    pathResult,
    buildSwapTransaction,
    account?.publicKey,
    sourceAmount,
    network,
    scanTransaction,
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
        throw new Error(signingError || "Failed to sign transaction");
      }

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

      snapshotHandle = startConfirmationPriceSnapshot({
        canonicalIds: [sourceCanonicalId, destCanonicalId],
        network,
        useV2: useRemoteConfigStore.getState().use_token_prices_v2,
        cachedDisplayPrices: {
          [sourceCanonicalId]: {
            currentPrice: freshSource.currentPrice ?? null,
          },
          [destCanonicalId]: { currentPrice: freshDest.currentPrice ?? null },
        },
      });

      // submitTransaction will throw if it fails (including debug overrides)
      // or return the hash if successful. If it returns null, surface the
      // stored error to keep the toast message accurate (e.g. DEBUG failures).
      didSubmit = true;
      const transactionHash = await submitTransaction({ network });

      if (!transactionHash) {
        const { error: submitError, submitErrorResultCodes } =
          useTransactionBuilderStore.getState();
        const errorMessage = submitError || "Failed to submit transaction";
        const submitFailure = new Error(errorMessage) as Error & {
          quoteExpiredCodes?: string[];
          resultCodes?: { transaction?: string; operations?: string[] } | null;
        };
        submitFailure.quoteExpiredCodes = getQuoteExpiredOperationCodes(
          submitErrorResultCodes,
        );
        submitFailure.resultCodes = submitErrorResultCodes;
        throw submitFailure;
      }

      // Get fresh slippage value for analytics
      const { swapSlippage: freshSwapSlippage } =
        useSwapSettingsStore.getState();

      // Settled destination amount, read from the transaction result — never
      // the quote. Horizon's submit response carries `result_xdr`
      // synchronously, so an unreadable read here is a genuine derivation
      // failure (`error`), not a "not observed" case — there's no
      // navigate-away window between submit and reading the response.
      const submittedTx = TransactionBuilder.fromXdr(
        signedXDR,
        networkDetails.networkPassphrase,
      );
      const opIndex = findPathPaymentStrictSendIndex(submittedTx);
      const { submitResultXdr } = useTransactionBuilderStore.getState();
      const settledDestAmount = submitResultXdr
        ? getSettledPathPaymentStrictSendAmount(submitResultXdr, opIndex)
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

      // Fire SWAP_TRUSTLINE_ADDED when the combined changeTrust +
      // pathPaymentStrictSend transaction confirmed a new trustline.
      const { destinationToken: swappedDestination } = useSwapStore.getState();
      if (swappedDestination?.requiresTrustline) {
        analytics.track(AnalyticsEvent.SWAP_TRUSTLINE_ADDED, {
          asset_code: destinationTokenInput.tokenCode,
          asset_issuer: swappedDestination.issuer ?? "",
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

      const submitResultCodes =
        error instanceof Error
          ? (
              error as Error & {
                resultCodes?: { transaction?: string; operations?: string[] };
              }
            ).resultCodes
          : undefined;

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
        const { submitErrorHttpStatus, submitErrorIsProtocolAnswer } =
          useTransactionBuilderStore.getState();
        volume = {
          identity: sourceIdentity,
          toIdentity: destIdentity,
          amount: new BigNumber(sourceAmount || 0).toNumber(),
          sourceLeg,
          priceSource: snapshot.source,
          priceFreshness: snapshot.freshness,
          reasonCode,
          failureCategory: getFailureCategory(
            submitErrorIsProtocolAnswer,
            submitErrorHttpStatus,
            reasonCode,
          ),
        };
      }

      if (isQuoteExpired) {
        // Over-slippage / liquidity-changed rejection: fire the dedicated
        // event instead of SWAP_FAIL and prompt the user to retry for a
        // fresh quote. `resultCode` carries the Horizon op code(s) that drove
        // the expiry so we can slice by reason.
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
        // this the failure the failure_category exists to measure never
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

        // The frozen quote is stale — fetch a fresh path so the user's retry
        // uses a new quote instead of resubmitting the expired one.
        const {
          sourceBalance: latestSource,
          destinationTokenInput: latestDest,
        } = swapBalancesRef.current;
        if (latestSource && latestDest && account.publicKey) {
          // Fire-and-forget: findSwapPath updates the store and handles its own
          // errors (matches how useSwapPathFinding invokes it).
          useSwapStore.getState().findSwapPath({
            sourceBalance: latestSource,
            destinationBalance: latestDest,
            sourceAmount,
            slippage: useSwapSettingsStore.getState().swapSlippage,
            network,
            publicKey: account.publicKey,
          });
        }

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
    transactionScanResult,
  };
};
