import BigNumber from "bignumber.js";
import { buildEarnSwapDestination } from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import {
  useSwapAmountError,
  useSwapBalances,
  useSwapCtaState,
  useSwapPathFinding,
  useSwapSecurityAssessments,
} from "components/screens/SwapScreen/hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { descriptorAsPathBalance, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSpendableAmount } from "helpers/balances";
import { HeldBalanceItem, useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useCallback, useEffect, useMemo } from "react";

/**
 * Token types `pathPaymentStrictSend` can spend. Soroban/custom tokens and
 * liquidity-pool shares are excluded: Swap is classic-only, so neither is a
 * viable source however large the balance.
 */
const SWAPPABLE_SOURCE_TYPES = new Set<TokenTypeWithCustomToken>([
  TokenTypeWithCustomToken.NATIVE,
  TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  TokenTypeWithCustomToken.CREDIT_ALPHANUM12,
]);

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
}: UseEarnSwapParams) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { swapFee, swapSlippage } = useSwapSettingsStore();
  const { isBuilding, transactionXDR } = useTransactionBuilderStore();
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
    setSourceToken,
    setDestinationToken,
    setSourceAmount,
    setSourceAmountDisplay,
  } = useSwapStore();

  // Rebuilt from the catalog's canonical "CODE:ISSUER" because Earn addresses
  // reserves by SAC contract id and swapping is classic-only. Null means the
  // reserve has no classic form, i.e. there is no swap path to offer at all.
  const destination = useMemo(
    () => (option ? buildEarnSwapDestination(option) : null),
    [option],
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
        // `tokenType` is the discriminant `HeldBalanceItem` actually carries.
        return SWAPPABLE_SOURCE_TYPES.has(item.tokenType);
      }),
    [balanceItems, destination],
  );

  /** The opening source: whichever swappable holding is worth the most. */
  const defaultSourceBalance = useMemo(
    () =>
      swappableBalances.reduce<HeldBalanceItem | undefined>((best, item) => {
        const value = item.fiatTotal ?? new BigNumber(0);
        const bestValue = best?.fiatTotal ?? new BigNumber(0);
        return value.gt(bestValue) ? item : best;
      }, undefined),
    [swappableBalances],
  );

  // Seed the swap store when the sheet opens. Guarded on the destination
  // actually changing so re-renders (and the user then picking a different
  // source) do not stomp the selection back to the default.
  useEffect(() => {
    if (!destination) {
      return;
    }
    setDestinationToken(destination);
  }, [destination, setDestinationToken]);

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

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) {
      return null;
    }
    return calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });
  }, [sourceBalance, account, swapFee]);

  const { amountError } = useSwapAmountError({
    sourceBalance,
    sourceAmount,
    balanceItems,
    swapFee,
    subentryCount: account?.subentryCount || 0,
    transactionHash: null,
    spendableAmount,
    sourceTokenSymbol,
    pathError,
    pathResult,
    destinationTokenDescriptor,
  });

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

  useSwapPathFinding({
    sourceBalance,
    destinationTokenForPath: destinationForPath,
    sourceAmount,
    swapSlippage,
    network,
    publicKey,
    amountError,
  });

  const { ctaLabel, isCtaDisabled } = useSwapCtaState({
    sourceBalance,
    destinationTokenDescriptor,
    sourceAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding,
    pathResult,
    pathError,
    amountError,
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
    account,
    network,
    // No `navigation`: this runs from a sheet, not a `SWAP_STACK` route.
    onProcessingClose,
  });

  const {
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    isMalicious,
    isSuspicious,
  } = useSwapSecurityAssessments({
    transactionScanResult,
    overriddenBlockaidResponse,
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor,
    scanResults,
    sourceTokenId,
  });

  const handlePercentagePress = useCallback(
    (percentage: number) => {
      if (!spendableAmount) {
        return;
      }
      const next = spendableAmount.multipliedBy(percentage).dividedBy(100);
      setTokenAmount(next.toFixed());
    },
    [spendableAmount, setTokenAmount],
  );

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
    ctaLabel,
    isCtaDisabled,
    handlePercentagePress,
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
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
    isBuilding,
    transactionXDR,
  };
};
