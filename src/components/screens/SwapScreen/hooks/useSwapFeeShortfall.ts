import { SWAP_TOAST_IDS } from "components/screens/SwapScreen/hooks/useSwapAmountError";
import { PricedBalance } from "config/types";
import { isNativeAssetId } from "helpers/assetIdentity";
import { calculateSpendableAmount } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useEffect } from "react";

type SetActiveError = (
  error: { message: string; toastId: string; duration: number } | null,
) => void;

/**
 * Whether the account lacks the XLM to pay a Soroban route's whole network
 * fee, and the "insufficient XLM for fees" toast when it does. Shared by main
 * Swap and the swap inside Earn.
 *
 * As on the extension: only a non-XLM source pays the fee from a separate XLM
 * balance (an XLM source's spendable amount already nets it out), and only
 * what sits above the minimum balance can pay it. The amount error stays on
 * the inclusion fee alone: it pauses path-finding, and the resource fee comes
 * from the quote, so gating it on the total would hold a stale fee until the
 * user edits the amount.
 */
export const useSwapFeeShortfall = ({
  resourceFee,
  totalFee,
  sourceBalance,
  balanceItems,
  subentryCount,
  transactionHash,
  setActiveError,
}: {
  resourceFee: string | null | undefined;
  totalFee: string;
  sourceBalance: PricedBalance | undefined;
  balanceItems: HeldBalanceItem[];
  subentryCount: number | undefined;
  transactionHash: string | null | undefined;
  setActiveError: SetActiveError;
}): boolean => {
  const { t } = useAppTranslation();

  const xlmBalance = balanceItems.find((b) => isNativeAssetId(b.id));
  const lacksXlmForTotalFee =
    !!resourceFee &&
    !!sourceBalance &&
    !isNativeAssetId(sourceBalance.id) &&
    (!xlmBalance ||
      calculateSpendableAmount({
        balance: xlmBalance,
        subentryCount: subentryCount || 0,
        transactionFee: "0",
      }).lt(totalFee));

  useEffect(() => {
    if (!lacksXlmForTotalFee || transactionHash) return;
    setActiveError({
      message: t("swapScreen.errors.insufficientXlmForFees", {
        fee: totalFee,
      }),
      toastId: SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES,
      duration: 3000,
    });
  }, [lacksXlmForTotalFee, transactionHash, totalFee, setActiveError, t]);

  return lacksXlmForTotalFee;
};
