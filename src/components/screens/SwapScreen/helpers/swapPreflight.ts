import BigNumber from "bignumber.js";
import { BASE_RESERVE } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { isNativeAssetId, isNativeBalance } from "helpers/assetIdentity";
import { calculateSpendableAmount } from "helpers/balances";
import { hasDecimals } from "helpers/formatAmount";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

/**
 * What the source balance can actually put into a swap: its spendable amount
 * (`calculateSpendableAmount`), in whole tokens, minus the BASE_RESERVE
 * (0.5 XLM) a new trustline locks when XLM itself is swapped into a token
 * without one. That keeps the reserve out of the percentage buttons and the
 * insufficient-balance check. Below BASE_RESERVE nothing is deducted, and the
 * reserve pre-flight below surfaces the shortfall instead.
 *
 * `transactionFee` is the swap's whole network fee in XLM, a Soroban route's
 * resource fee included (`useSwapQuoteFees`'s `spendableFee`).
 */
export const getSwapSpendableAmount = ({
  sourceBalance,
  subentryCount,
  transactionFee,
  destinationRequiresTrustline,
}: {
  sourceBalance: PricedBalance & { id: string };
  subentryCount: number;
  transactionFee: string;
  destinationRequiresTrustline: boolean;
}): BigNumber => {
  const rawSpendable = calculateSpendableAmount({
    balance: sourceBalance,
    subentryCount,
    transactionFee,
  });
  // A Soroban balance is in the token's smallest unit.
  const baseSpendable = hasDecimals(sourceBalance)
    ? rawSpendable.shiftedBy(-sourceBalance.decimals)
    : rawSpendable;
  const swappingXlmToNewToken =
    isNativeAssetId(sourceBalance.id) && destinationRequiresTrustline;
  if (swappingXlmToNewToken && baseSpendable.gte(BASE_RESERVE)) {
    return baseSpendable.minus(BASE_RESERVE);
  }
  return baseSpendable;
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

  const xlmBalance = balanceItems.find((b) => isNativeBalance(b));
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

/**
 * The quote for the current inputs hasn't arrived yet. A failed quote stores
 * its key too, so it settles; an amount error stops the request, so it never
 * settles and must not count as pending.
 */
export const isSwapQuotePending = ({
  currentQuoteKey,
  sourceAmount,
  amountError,
  isQuoteCurrent,
  pathErrorQuoteKey,
}: {
  currentQuoteKey: string | null;
  sourceAmount: string;
  amountError: string | null;
  isQuoteCurrent: boolean;
  pathErrorQuoteKey: string | null;
}): boolean =>
  !!currentQuoteKey &&
  new BigNumber(sourceAmount || "0").gt(0) &&
  !amountError &&
  !isQuoteCurrent &&
  pathErrorQuoteKey !== currentQuoteKey;

/**
 * The quote for the current inputs failed for a reason the amount screen
 * explains in its "Quote unavailable" line.
 */
export const shouldShowSwapQuoteUnavailable = ({
  isLoadingPath,
  currentQuoteKey,
  pathErrorQuoteKey,
  isInsufficient,
  amountError,
  sourceAmount,
  hasPathErrorReason,
}: {
  isLoadingPath: boolean;
  currentQuoteKey: string | null;
  pathErrorQuoteKey: string | null;
  isInsufficient: boolean;
  amountError: string | null;
  sourceAmount: string;
  hasPathErrorReason: boolean;
}): boolean =>
  !isLoadingPath &&
  !!currentQuoteKey &&
  pathErrorQuoteKey === currentQuoteKey &&
  !isInsufficient &&
  !amountError &&
  new BigNumber(sourceAmount || "0").gt(0) &&
  hasPathErrorReason;
