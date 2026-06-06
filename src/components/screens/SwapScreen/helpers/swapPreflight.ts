import BigNumber from "bignumber.js";
import { BASE_RESERVE, isNativeAssetId } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { calculateSpendableAmount } from "helpers/balances";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

/**
 * Pure pre-flight predicate: when the destination is a
 * new token (a trustline must be added), the user needs at least
 * BASE_RESERVE (0.5 XLM) of spendable headroom AFTER the swap to cover
 * the new trustline's reserve bump. If they don't, the caller surfaces
 * the XlmReserveBottomSheet instead of the review sheet.
 *
 * The math mirrors the source-side spendable-amount check exactly:
 *   - Subtract swap fee + subentries via `calculateSpendableAmount`
 *     (which is what `available - sellingLiabilities - minimumBalance`
 *     would miss).
 *   - When XLM is the source token, the sourceAmount is about to leave
 *     the account in the swap — subtract it from the projected spendable
 *     so the gate evaluates POST-swap headroom.
 *   - The combined trustline + path-payment transaction has 2 ops, so
 *     the actual fee is 2× the per-op fee. calculateSpendableAmount
 *     already deducted one op via the transactionFee parameter — deduct
 *     one more here so the gate doesn't pass an account that lacks fee
 *     headroom for op #1.
 *
 * The `lte` boundary check is intentional: the exact-boundary case
 * (spendable === BASE_RESERVE) routes to the reserve sheet because the
 * user has zero margin AFTER the trustline.
 *
 * Returns `false` when the destination isn't `isNew` (no trustline op
 * needed → no reserve concern).
 */
export const shouldShowXlmReservePreflight = ({
  balanceItems,
  subentryCount,
  swapFee,
  sourceTokenId,
  sourceAmount,
  destinationIsNew,
}: {
  balanceItems: BalanceItem[];
  subentryCount: number;
  swapFee: string;
  sourceTokenId: string | undefined;
  sourceAmount: string;
  destinationIsNew: boolean;
}): boolean => {
  if (!destinationIsNew) return false;

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

  const isXlmSource = isNativeAssetId(sourceTokenId ?? "");
  const extraTrustlineOpFee = new BigNumber(swapFee);
  const projectedSpendable = (
    isXlmSource
      ? xlmSpendable.minus(new BigNumber(sourceAmount || "0"))
      : xlmSpendable
  ).minus(extraTrustlineOpFee);

  return projectedSpendable.lte(BASE_RESERVE);
};
