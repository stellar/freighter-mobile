import Blockaid from "@blockaid/client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  getQuoteExpiredOperationCodes,
  getTokenFromBalance,
} from "components/screens/SwapScreen/helpers";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  SWAP_ROUTES,
  SwapStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { PricedBalance, NativeToken, NonNativeToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useHistoryStore } from "ducks/history";
import { SwapPathResult, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";

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
    // When isNew === true the user doesn't yet hold a trustline for the
    // destination asset; the changeTrust op is prepended atomically.
    const { destinationToken } = useSwapStore.getState();
    let includeTrustline: { tokenCode: string; issuer: string } | undefined;
    if (destinationToken?.isNew) {
      if (!destinationToken.issuer) {
        // Unreachable in practice: native XLM can't be isNew, and the picker
        // filters out Soroban. Fail fast so the bug surfaces here rather than
        // submitting a doomed transaction that fails on-chain with tx_no_trust.
        throw new Error(
          `useSwapTransaction: isNew=true but issuer missing on destinationToken (id=${destinationToken.id})`,
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

    try {
      const signedXDR = signTransaction({
        secretKey: account.privateKey,
        network,
      });

      if (!signedXDR) {
        // Get the error message stored in the transaction builder
        const { error: signingError } = useTransactionBuilderStore.getState();
        throw new Error(signingError || "Failed to sign transaction");
      }

      // submitTransaction will throw if it fails (including debug overrides)
      // or return the hash if successful. If it returns null, surface the
      // stored error to keep the toast message accurate (e.g. DEBUG failures).
      const transactionHash = await submitTransaction({ network });

      if (!transactionHash) {
        const { error: submitError, submitErrorResultCodes } =
          useTransactionBuilderStore.getState();
        const errorMessage = submitError || "Failed to submit transaction";
        const submitFailure = new Error(errorMessage) as Error & {
          quoteExpiredCodes?: string[];
        };
        submitFailure.quoteExpiredCodes = getQuoteExpiredOperationCodes(
          submitErrorResultCodes,
        );
        throw submitFailure;
      }

      // Get fresh slippage value for analytics
      const { swapSlippage: freshSwapSlippage } =
        useSwapSettingsStore.getState();

      analytics.trackSwapSuccess({
        sourceToken: sourceBalance.tokenCode,
        destToken: destinationTokenInput.tokenCode,
        sourceAmount,
        destAmount: pathResult?.destinationAmount,
        allowedSlippage: freshSwapSlippage?.toString(),
        isSwap: true,
      });

      // Fire SWAP_TRUSTLINE_ADDED when the combined changeTrust +
      // pathPaymentStrictSend transaction confirmed a new trustline.
      const { destinationToken: swappedDestination } = useSwapStore.getState();
      if (swappedDestination?.isNew) {
        analytics.track(AnalyticsEvent.SWAP_TRUSTLINE_ADDED, {
          tokenCode: destinationTokenInput.tokenCode,
          tokenIssuer: swappedDestination.issuer ?? "",
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

      if (isQuoteExpired) {
        // Over-slippage / liquidity-changed rejection: fire the dedicated
        // event instead of SWAP_FAIL and prompt the user to retry for a
        // fresh quote. `resultCode` carries the Horizon op code(s) that drove
        // the expiry so we can slice by reason.
        analytics.track(AnalyticsEvent.SWAP_QUOTE_EXPIRED, {
          sourceToken: sourceBalance?.tokenCode,
          destToken: destinationTokenInput?.tokenCode,
          sourceAmount,
          destAmount: pathResult?.destinationAmount,
          allowedSlippage: useSwapSettingsStore
            .getState()
            .swapSlippage?.toString(),
          resultCode: quoteExpiredCodes.join(", "),
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
        isSwap: true,
        sourceToken: sourceBalance?.tokenCode,
        destToken: destinationTokenInput?.tokenCode,
        sourceAmount,
        destAmount: pathResult?.destinationAmount,
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
