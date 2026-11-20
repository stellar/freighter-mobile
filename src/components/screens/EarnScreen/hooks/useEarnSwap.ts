import BigNumber from "bignumber.js";
import {
  buildEarnSwapDestination,
  getPercentageAmount,
} from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import {
  buildSwapNetworkFeeTexts,
  getSwapSpendableAmount,
  isClassicTokenType,
  isSwapQuotePending,
  shouldShowSwapQuoteUnavailable,
} from "components/screens/SwapScreen/helpers";
import {
  useStableConversionRate,
  useSwapAmountError,
  useSwapBalances,
  useSwapCtaState,
  useSwapFeeShortfall,
  useSwapPathFinding,
  useSwapQuoteFees,
  useSwapRouteView,
  useSwapSecurityAssessments,
} from "components/screens/SwapScreen/hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { DEFAULT_DECIMALS, TransactionContext } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { descriptorAsPathBalance, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { HeldBalanceItem, useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { scanToken } from "services/blockaid/api";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

export interface UseEarnSwapParams {
  /**
   * The reserve the user was trying to deposit into and does not hold. Null
   * while the sheet is closed -- the hook then does no work and writes
   * nothing to the swap store.
   */
  option: EarnTokenOption | null;
  /**
   * Where to go when the swap's processing screen closes. Earn returns the
   * user to the token picker holding their new balance, rather than Swap's
   * default reset onto the History tab -- see `useSwapTransaction`.
   */
  onProcessingClose: () => void;
  /**
   * The submit was rejected because the quote expired. A fresh quote is
   * already being fetched for the same source and amount; the caller takes
   * the user back to the swap sheet to retry with it.
   */
  onQuoteExpired: () => void;
}

/**
 * Owns swap-within-Earn's state: destination locked to the pool reserve,
 * source chosen from what the account actually holds, and the amount /
 * path-finding / CTA machinery reused wholesale from Swap.
 *
 * Everything here is Swap's own hooks, deliberately. The only Earn-specific
 * parts are (a) the destination is fixed rather than picked, and (b) the
 * source defaults to the account's best swappable balance so the sheet opens
 * ready to type rather than on an empty picker.
 */
export const useEarnSwap = ({
  option,
  onProcessingClose,
  onQuoteExpired,
}: UseEarnSwapParams) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { swapFee } = useSwapSettingsStore();
  const { isBuilding, transactionXDR, transactionHash, resetTransaction } =
    useTransactionBuilderStore();
  const publicKey = account?.publicKey ?? "";

  const { balanceItems, scanResults } = useBalancesList({ publicKey, network });
  const { overriddenBlockaidResponse } = useDebugStore();

  const {
    sourceTokenId,
    sourceTokenSymbol,
    sourceAmount,
    destinationAmount,
    destinationToken: destinationTokenDescriptor,
    pathResult,
    isLoadingPath,
    pathError,
    pathErrorReason,
    pathErrorQuoteKey,
    setSourceToken,
    setDestinationToken,
    setEntrySource,
    setSourceAmount,
    setSourceAmountDisplay,
    resetSwap,
  } = useSwapStore();

  // Rebuilt from the catalog's canonical "CODE:ISSUER" because Earn addresses
  // reserves by SAC contract id and swapping is classic-only. Null means the
  // reserve has no classic form, i.e. there is no swap path to offer at all.
  const destination = useMemo(
    () => (option ? buildEarnSwapDestination(option) : null),
    [option],
  );

  // Start the swap at the network's recommended fee, as main Swap does,
  // scaled by its operations: a destination without a trustline adds one.
  // Frozen once an amount is entered, so a fee refresh can't shrink a
  // committed amount's spendable balance. Nothing is written while no swap
  // is open.
  const { recommendedFee, networkCongestion, feePresets } = useNetworkFees();
  const hasEnteredSourceAmount = new BigNumber(sourceAmount || "0").gt(0);
  useInitialRecommendedFee(
    destination && !hasEnteredSourceAmount ? recommendedFee : "",
    TransactionContext.Swap,
    destination?.requiresTrustline ? 2 : 1,
    networkCongestion,
    destination ? feePresets : undefined,
  );

  /**
   * Everything the account could sell into the destination. Excludes the
   * destination itself (swapping USDC into USDC is not a thing) and anything
   * Swap cannot spend -- contract-only balances and liquidity-pool shares are
   * not classic-path sources. Also backs the "Swap from" picker.
   */
  const swappableBalances = useMemo(
    () =>
      balanceItems.filter((item) => {
        if (item.id === destination?.id) {
          return false;
        }
        if (!new BigNumber(item.total ?? 0).gt(0)) {
          return false;
        }
        // `pathPaymentStrictSend` spends only classic tokens: Soroban tokens
        // and liquidity-pool shares can't be a source however large.
        return isClassicTokenType(item.tokenType);
      }),
    [balanceItems, destination],
  );

  /**
   * The opening source: whichever swappable holding is worth the most, or
   * XLM when none has a price (testnet, or an unpriced wallet), so the sheet
   * still opens ready to type.
   */
  const defaultSourceBalance = useMemo(() => {
    const mostValuable = swappableBalances.reduce<HeldBalanceItem | undefined>(
      (best, item) => {
        const value = item.fiatTotal ?? new BigNumber(0);
        const bestValue = best?.fiatTotal ?? new BigNumber(0);
        return value.gt(bestValue) ? item : best;
      },
      undefined,
    );
    return (
      mostValuable ??
      swappableBalances.find(
        (item) => item.tokenType === TokenTypeWithCustomToken.NATIVE,
      ) ??
      swappableBalances[0]
    );
  }, [swappableBalances]);

  // Seed the swap store when the sheet opens. Guarded on the destination
  // actually changing so re-renders (and the user then picking a different
  // source) do not stomp the selection back to the default.
  useEffect(() => {
    if (!destination) {
      return undefined;
    }
    setDestinationToken(destination);
    // The swap's events report it as opened from Earn, as the extension's do.
    setEntrySource("earn");

    // A destination the account doesn't hold yet carries no Blockaid verdict,
    // so scan it as main Swap does for its default destination. Without one,
    // every Earn swap would read as unable to scan. A failed scan leaves the
    // level unset, which the review treats as unable to scan.
    if (!destination.requiresTrustline || !destination.issuer) {
      return undefined;
    }
    let isCurrent = true;
    scanToken({
      tokenCode: destination.tokenCode,
      tokenIssuer: destination.issuer,
      network,
    })
      .then((scanResult) => {
        const current = useSwapStore.getState().destinationToken;
        if (!isCurrent || current?.id !== destination.id) {
          return;
        }
        setDestinationToken({
          ...current,
          securityLevel: assessTokenSecurity(scanResult).level,
          securityWarnings: extractSecurityWarnings(scanResult),
        });
      })
      .catch(() => {
        // Unable to scan: the review's gate shows the security sheet.
      });
    return () => {
      isCurrent = false;
    };
  }, [destination, setDestinationToken, setEntrySource, network]);

  useEffect(() => {
    if (!destination || sourceTokenId || !defaultSourceBalance) {
      return;
    }
    setSourceToken(
      defaultSourceBalance.id,
      defaultSourceBalance.tokenCode ?? "",
    );
  }, [destination, sourceTokenId, defaultSourceBalance, setSourceToken]);

  const { sourceBalance, destinationBalance } = useSwapBalances({
    balanceItems,
    sourceTokenId,
    destinationTokenDescriptor,
  });

  const converter = useTokenFiatConverter({ selectedBalance: sourceBalance });
  const { tokenAmount, tokenAmountDisplay, setTokenAmount } = converter;

  // The store's `sourceAmount` stays the single source of truth for
  // path-finding, exactly as `SwapAmountScreen` does it.
  useEffect(() => {
    setSourceAmount(tokenAmount);
    setSourceAmountDisplay(tokenAmountDisplay);
  }, [
    tokenAmount,
    tokenAmountDisplay,
    setSourceAmount,
    setSourceAmountDisplay,
  ]);

  /**
   * Clears the swap the sheet was building: source, amount, quote, the
   * locked destination and the transaction staged for Review. Without it the
   * next swap reopened on the previous one's source and amount, even when
   * that source was now the destination, and a swap built for Review but
   * never confirmed stayed signable.
   */
  const reset = useCallback(() => {
    setTokenAmount("0");
    resetSwap();
    resetTransaction();
  }, [setTokenAmount, resetSwap, resetTransaction]);

  // A finished swap is reset once the caller has read what it needs from it.
  const handleSwapClosed = useCallback(() => {
    onProcessingClose();
    reset();
  }, [onProcessingClose, reset]);

  // The destination is never held here (the whole sheet exists because the
  // account has none of it), so this is always the descriptor shim rather
  // than a real balance row -- the same one `SwapAmountScreen` feeds
  // path-finding for its own non-held destinations.
  const destinationForPath: HeldBalanceItem | undefined = useMemo(
    () =>
      destinationTokenDescriptor
        ? descriptorAsPathBalance(destinationTokenDescriptor)
        : undefined,
    [destinationTokenDescriptor],
  );

  // As on main Swap: the quote counts only while it answers these exact
  // inputs, and the fees include a Soroban route's resource fee.
  const {
    currentQuoteKey,
    isQuoteCurrent,
    resourceFee,
    totalFee,
    spendableFee,
  } = useSwapQuoteFees({
    sourceBalance,
    destinationBalance: destinationForPath,
    sourceAmount,
    network,
    publicKey,
    swapFee,
  });

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) {
      return null;
    }
    // As on main Swap, Max and the balance check leave out the network fee,
    // a Soroban route's resource fee included, and the 0.5 XLM a new
    // trustline locks. The "not enough" sheet only offers a swap into a
    // new token when the account has more XLM headroom than that
    // (`hasSwappableBalance`).
    return getSwapSpendableAmount({
      sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: spendableFee,
      destinationRequiresTrustline:
        !!destinationTokenDescriptor?.requiresTrustline,
    });
  }, [
    sourceBalance,
    account,
    spendableFee,
    destinationTokenDescriptor?.requiresTrustline,
  ]);

  const { amountError, setActiveError } = useSwapAmountError({
    sourceBalance,
    sourceAmount,
    balanceItems,
    swapFee,
    subentryCount: account?.subentryCount || 0,
    // A submitted swap has spent the amount still held here until its
    // sheet closes, so a balance refresh mustn't call it unaffordable.
    transactionHash,
    spendableAmount,
    sourceTokenSymbol,
    pathError,
    pathErrorReason,
    pathResult,
    destinationTokenDescriptor,
  });

  // A non-XLM source pays a Soroban route's whole fee from the account's XLM.
  const lacksXlmForTotalFee = useSwapFeeShortfall({
    resourceFee,
    totalFee,
    sourceBalance,
    balanceItems,
    subentryCount: account?.subentryCount,
    transactionHash,
    setActiveError,
  });

  const isQuotePending = isSwapQuotePending({
    currentQuoteKey,
    sourceAmount,
    amountError,
    isQuoteCurrent,
    pathErrorQuoteKey,
  });

  useSwapPathFinding({
    sourceBalance,
    destinationTokenForPath: destinationForPath,
    sourceAmount,
    network,
    publicKey,
    amountError,
  });

  const {
    ctaState,
    ctaLabel,
    isCtaDisabled: isCtaStateDisabled,
  } = useSwapCtaState({
    sourceBalance,
    destinationTokenDescriptor,
    sourceAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding,
    pathResult,
    pathError,
    amountError,
    currentQuoteKey,
    isQuotePending,
  });
  const isCtaDisabled = isCtaStateDisabled || lacksXlmForTotalFee;

  const showQuoteUnavailable = shouldShowSwapQuoteUnavailable({
    isLoadingPath,
    currentQuoteKey,
    pathErrorQuoteKey,
    isInsufficient: ctaState.kind === "insufficient",
    amountError,
    sourceAmount,
    hasPathErrorReason: pathErrorReason !== null,
  });

  // "See details": the fee, the route and the rate, as on main Swap.
  const { networkFeeText, networkFeeFiatText } = buildSwapNetworkFeeTexts({
    totalFee,
    balanceItems,
  });
  const swapRouteView = useSwapRouteView(balanceItems, network);
  const { stableConversionRate } = useStableConversionRate({
    pathResult: isQuoteCurrent ? pathResult : null,
    sourceTokenSymbol,
    destinationTokenSymbol: destinationTokenDescriptor?.tokenCode ?? "",
  });

  const {
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    transactionScanResult,
    sourceToken,
    destinationToken,
  } = useSwapTransaction({
    sourceAmount,
    sourceBalance,
    destinationTokenInput: destinationForPath,
    pathResult,
    currentQuoteKey,
    account,
    network,
    recommendedFee,
    // No `navigation`: this runs from a sheet, not a `SWAP_STACK` route.
    onProcessingClose: handleSwapClosed,
    onQuoteExpired,
  });

  const {
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    isMalicious,
    isSuspicious,
    isUnableToScan,
    isTokenUnableToScan,
    securityWarnings,
    swapSecuritySeverity,
  } = useSwapSecurityAssessments({
    transactionScanResult,
    overriddenBlockaidResponse,
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor,
    scanResults,
    sourceTokenId,
  });

  // As on main Swap: Max taps before the pair's first quote can't know its
  // resource fee. When that quote leaves the Max amount over spendable, Max
  // is applied again, once per tap, so a fee that moves with the amount
  // can't keep re-sizing it.
  const maxPendingRef = useRef<string | null>(null);
  const handlePercentagePress = useCallback(
    (percentage: number, isTap = true) => {
      if (!spendableAmount) {
        return;
      }
      maxPendingRef.current = null;
      // Swap is classic-only, and classic assets carry 7 decimals.
      const amount = getPercentageAmount({
        maxAmount: spendableAmount.toFixed(),
        pct: percentage,
        decimals: DEFAULT_DECIMALS,
      });
      setTokenAmount(amount);
      if (percentage === 100 && isTap) {
        maxPendingRef.current = amount;
      }
    },
    [spendableAmount, setTokenAmount],
  );

  useEffect(() => {
    const pending = maxPendingRef.current;
    // Only the quote for the Max amount itself settles it.
    if (
      pending === null ||
      !isQuoteCurrent ||
      !spendableAmount ||
      !new BigNumber(pending).eq(sourceAmount || "0")
    ) {
      return;
    }
    maxPendingRef.current = null;
    if (spendableAmount.lt(pending)) {
      handlePercentagePress(100, false);
    }
  }, [isQuoteCurrent, spendableAmount, sourceAmount, handlePercentagePress]);

  const selectSource = useCallback(
    (balance: HeldBalanceItem) => {
      setSourceToken(balance.id, balance.tokenCode ?? "");
      // Amounts are denominated in the OLD source; carrying one over would
      // silently re-quote a different value than the user typed.
      setTokenAmount("0");
    },
    [setSourceToken, setTokenAmount],
  );

  return {
    destination,
    swappableBalances,
    selectSource,
    sourceBalance,
    sourceTokenSymbol,
    converter,
    spendableAmount,
    amountError,
    pathResult,
    isLoadingPath,
    // The quote and its fees, for the sheet's receive card and its lines.
    isQuoteCurrent,
    isQuotePending,
    showQuoteUnavailable,
    resourceFee,
    networkFeeText,
    networkFeeFiatText,
    swapRouteView,
    stableConversionRate,
    ctaState,
    ctaLabel,
    isCtaDisabled,
    handlePercentagePress,
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    reset,
    // Processing-screen inputs.
    sourceToken,
    destinationToken,
    sourceAmount,
    destinationAmount,
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    isMalicious,
    isSuspicious,
    isUnableToScan,
    isTokenUnableToScan,
    securityWarnings,
    swapSecuritySeverity,
    isBuilding,
    transactionXDR,
  };
};
