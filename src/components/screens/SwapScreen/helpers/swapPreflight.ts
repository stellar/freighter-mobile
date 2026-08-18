import BigNumber from "bignumber.js";
import { BASE_RESERVE, isNativeAssetId } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { calculateSpendableAmount } from "helpers/balances";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

/**
 * Pure pre-flight predicate: when the destination is a new token (a
 * trustline must be added), the user needs BASE_RESERVE (0.5 XLM) of XLM
 * headroom to cover the new trustline's reserve bump. If they don't, the
 * caller surfaces the XlmReserveBottomSheet instead of the review sheet.
 *
 * Two source cases:
 *
 *   - **XLM source.** SwapAmountScreen already deducts BASE_RESERVE from
 *     the spendable amount up-front (so the percentage buttons + the
 *     insufficient-balance check exclude it), which is the primary
 *     mechanism that keeps the reserve intact. The sheet is therefore
 *     only the fallback for accounts that can't even reserve 0.5 to begin
 *     with — gate on the INITIAL spendable being below BASE_RESERVE.
 *     Gating on post-swap headroom here would double-count the reserve and
 *     surface the sheet at Max even though the deduction already reserved
 *     the 0.5.
 *
 *   - **Non-XLM source.** The reserve comes from the separate XLM balance,
 *     which the swap amount never touches — so there's no up-front
 *     deduction. Gate on the XLM balance's spendable headroom:
 *     calculateSpendableAmount already subtracts the full transaction fee
 *     (swapFee is the TOTAL across both the changeTrust and path-payment ops),
 *     so the remaining spendable just needs to cover the new trustline's
 *     BASE_RESERVE. The `lte` boundary routes the exact-boundary case to the
 *     reserve sheet (zero margin after the trustline).
 *
 * Returns `false` when the destination isn't `requiresTrustline` (no trustline op
 * needed → no reserve concern).
 */
export const shouldShowXlmReservePreflight = ({
  balanceItems,
  subentryCount,
  swapFee,
  sourceTokenId,
  destinationRequiresTrustline,
}: {
  balanceItems: BalanceItem[];
  subentryCount: number;
  swapFee: string;
  sourceTokenId: string | undefined;
  destinationRequiresTrustline: boolean;
}): boolean => {
  if (!destinationRequiresTrustline) return false;

  const xlmBalance = balanceItems.find(
    (b) => "token" in b && b.token.type === "native",
  );
  const xlmSpendable = xlmBalance
    ? calculateSpendableAmount({
        balance: xlmBalance,
        subentryCount,
        transactionFee: swapFee,
      })
    : new BigNumber(0);

  // XLM source: the up-front BASE_RESERVE deduction (SwapAmountScreen)
  // owns the reserve when there's at least 0.5 spendable. Only fall back
  // to the sheet when the initial spendable can't cover the reserve.
  if (isNativeAssetId(sourceTokenId ?? "")) {
    return xlmSpendable.lt(BASE_RESERVE);
  }

  // Non-XLM source: gate on post-fee XLM headroom. calculateSpendableAmount
  // already deducted the full transaction fee (swapFee is the TOTAL across both
  // ops), so the remaining spendable just needs to cover the trustline reserve.
  return xlmSpendable.lte(BASE_RESERVE);
};
