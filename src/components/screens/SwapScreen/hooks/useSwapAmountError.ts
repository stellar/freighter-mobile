import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { DEFAULT_DECIMALS } from "config/constants";
import { SwapPathResult } from "ducks/swap";
import { hasXLMForFees, isAmountSpendable } from "helpers/balances";
import { formatBigNumberForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useToast } from "providers/ToastProvider";
import { useEffect, useState } from "react";

/**
 * Toast-id sentinels. These strings cross the toast-rendering boundary
 * and DOUBLE as React keys for the toast provider's dedupe — two
 * setActiveError calls with the same toastId in succession are
 * collapsed into one visible toast. Keep stable: changing a value
 * silently changes the dedupe semantics + any analytics keyed on the id.
 */
export const SWAP_TOAST_IDS = {
  INSUFFICIENT_XLM_FOR_FEES: "insufficient-xlm-for-fees",
  INSUFFICIENT_BALANCE: "insufficient-balance",
  SWAP_PATH_ERROR: "swap-path-error",
  FAILED_TO_SETUP_TRANSACTION: "failed-to-setup-transaction",
} as const;

type SwapActiveError = {
  message: string;
  toastId: string;
  duration: number;
};

/**
 * Owns the swap amount-error state: returns an inline `amountError`
 * for the Sell card and a `setActiveError` setter that drives toasts.
 */
export const useSwapAmountError = ({
  sourceBalance,
  sourceAmount,
  balanceItems,
  swapFee,
  subentryCount,
  transactionHash,
  spendableAmount,
  sourceTokenSymbol,
  pathError,
  pathResult,
  destinationTokenDescriptor,
}: {
  sourceBalance: HeldBalanceItem | undefined;
  sourceAmount: string;
  balanceItems: HeldBalanceItem[];
  swapFee: string;
  subentryCount: number | undefined;
  transactionHash: string | null | undefined;
  spendableAmount: BigNumber | null;
  sourceTokenSymbol: string;
  pathError: string | null;
  pathResult: SwapPathResult | null;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
}): {
  amountError: string | null;
  setActiveError: (error: SwapActiveError | null) => void;
} => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const [amountError, setAmountError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<SwapActiveError | null>(null);

  // Input-validation effect — runs whenever the user types an amount or
  // their balances change. Two gates (in priority order):
  //  1. hasXLMForFees: account has enough XLM headroom for the
  //     swap fee + reserve. Fires INSUFFICIENT_XLM_FOR_FEES.
  //  2. isAmountSpendable: source has enough of the sell token AFTER
  //     accounting for the fee + subentries. Fires INSUFFICIENT_BALANCE.
  // transactionHash gates the second check off during the post-submit
  // window — the screen shows the spinner state, not the error toast.
  useEffect(() => {
    if (!sourceBalance || !sourceAmount || sourceAmount === "0") {
      setAmountError(null);
      return;
    }

    if (!hasXLMForFees(balanceItems, swapFee)) {
      const errorMessage = t("swapScreen.errors.insufficientXlmForFees", {
        fee: swapFee,
      });
      setAmountError(errorMessage);
      setActiveError({
        message: errorMessage,
        toastId: SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES,
        duration: 3000,
      });
      return;
    }

    if (
      !isAmountSpendable({
        amount: sourceAmount,
        balance: sourceBalance,
        subentryCount,
        transactionFee: swapFee,
      }) &&
      !transactionHash
    ) {
      const errorMessage = t("swapScreen.errors.insufficientBalance", {
        amount: spendableAmount
          ? formatBigNumberForDisplay(spendableAmount, {
              decimalPlaces: DEFAULT_DECIMALS,
            })
          : "0",
        symbol: sourceTokenSymbol,
      });
      setAmountError(errorMessage);
      setActiveError({
        message: errorMessage,
        toastId: SWAP_TOAST_IDS.INSUFFICIENT_BALANCE,
        duration: 3000,
      });
    } else {
      setAmountError(null);
    }
  }, [
    sourceAmount,
    spendableAmount,
    sourceTokenSymbol,
    t,
    subentryCount,
    swapFee,
    transactionHash,
    sourceBalance,
    balanceItems,
  ]);

  // Unified toast effect — fires showToast whenever activeError changes.
  // Provider-side dedupe collapses identical toastIds, so this is safe
  // to re-fire during the validation re-runs above.
  useEffect(() => {
    if (activeError) {
      showToast({
        variant: "error",
        title: activeError.message,
        toastId: activeError.toastId,
        duration: activeError.duration,
      });
    }
  }, [activeError, showToast]);

  // Persistent path-error toast — surfaced when path-finding fails AND
  // the user has entered an amount AND selected a destination. Auto-
  // dismisses when a subsequent path-finding cycle resolves
  // successfully so the toast doesn't cover the keyboard while the
  // user is typing a valid amount.
  useEffect(() => {
    const hasAmount = sourceAmount && Number(sourceAmount) > 0;
    const hasDestinationToken = !!destinationTokenDescriptor;

    if (pathError && hasAmount && hasDestinationToken) {
      setActiveError({
        message: pathError,
        toastId: SWAP_TOAST_IDS.SWAP_PATH_ERROR,
        duration: 0,
      });
    } else if (
      !pathError &&
      pathResult &&
      activeError?.toastId === SWAP_TOAST_IDS.SWAP_PATH_ERROR
    ) {
      setActiveError(null);
    }
  }, [
    pathError,
    pathResult,
    sourceAmount,
    destinationTokenDescriptor,
    activeError?.toastId,
  ]);

  return { amountError, setActiveError };
};
