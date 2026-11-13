import BigNumber from "bignumber.js";
import { BASE_RESERVE, NetworkDetails, NETWORKS } from "config/constants";
import { PricedBalanceMap } from "config/types";
import { isNativeToken } from "helpers/assetIdentity";
import { calculateSpendableAmount } from "helpers/balances";

/**
 * Assets the Coinbase onramp can sell, by code.
 *
 * The onramp URL is built from the bare code, so an unlisted asset produces a
 * dead-end page rather than an error. EURC is deliberately absent — it is not
 * Coinbase-listed, which is why the designs show no Buy button on its sheet.
 */
export const EARN_ONRAMP_ASSETS = new Set(["XLM", "USDC"]);

/**
 * Which button set the "Not enough X" sheet shows.
 *
 * `TRANSFER_ONLY` is for an account with nothing to swap from, on an asset
 * the onramp can't sell.
 */
export enum NotEnoughVariant {
  SWAP_OR_TRANSFER = "swap-or-transfer",
  BUY_OR_TRANSFER = "buy-or-transfer",
  BUY_SWAP_OR_TRANSFER = "buy-swap-or-transfer",
  TRANSFER_ONLY = "transfer-only",
}

/** Testnet assets are worthless, so the onramp is mainnet-only. */
export const isOnrampableAsset = (
  code: string,
  networkDetails: NetworkDetails,
) => EARN_ONRAMP_ASSETS.has(code) && networkDetails.network === NETWORKS.PUBLIC;

/**
 * Does the account hold anything it could actually swap into the target
 * asset?
 *
 * Only what is spendable counts, as on main Swap (`calculateSpendableAmount`):
 * XLM above the account's minimum balance and the swap's fee, and other
 * classic assets' available amount. Opening the target's trustline locks
 * another `BASE_RESERVE` of XLM whichever token is swapped, so a target that
 * needs one also requires more XLM headroom than that; main Swap draws the
 * same line before it shows its reserve sheet.
 *
 * Swap is classic-only — it builds a Horizon `pathPaymentStrictSend` and
 * rejects contract-ID assets outright — so a Soroban-only balance is not a
 * viable source. Native XLM counts: it is the most common source of all.
 *
 * Native detection uses the `type` discriminant (`token.type === "native"`),
 * NOT a code comparison against "XLM". `NativeToken` is
 * `{ type: TokenType.native; code: "XLM" }` but `NonNativeToken` is
 * `{ code: string; issuer: Issuer }` (config/types.ts) — any issuer can mint a
 * classic asset coded "XLM", so a code check would misclassify it as native
 * and as swappable-into-itself. This is the same defect fixed in
 * `getBalanceByContractId` (helpers/balances.ts); that idiom is reused here.
 *
 * `targetIdentifier` is excluded so a dust balance of the target itself never
 * makes the account look like it can swap into what it already has.
 */
export const hasSwappableBalance = ({
  balances,
  targetIdentifier,
  subentryCount,
  transactionFee,
  requiresTrustline,
}: {
  balances: PricedBalanceMap;
  targetIdentifier: string;
  /** Sizes XLM's minimum balance when the balance doesn't carry it. */
  subentryCount: number;
  /** The swap's total fee, in XLM. */
  transactionFee: string;
  /** Whether the swap must open a trustline for the target first. */
  requiresTrustline: boolean;
}) => {
  const entries = Object.entries(balances);
  const xlmBalance = entries.find(
    ([, balance]) => "token" in balance && isNativeToken(balance.token),
  )?.[1];
  const spendableXlm = xlmBalance
    ? calculateSpendableAmount({
        balance: xlmBalance,
        subentryCount,
        transactionFee,
      })
    : new BigNumber(0);

  if (requiresTrustline && spendableXlm.lte(BASE_RESERVE)) {
    return false;
  }
  const xlmLeftToSwap = requiresTrustline
    ? spendableXlm.minus(BASE_RESERVE)
    : spendableXlm;

  return entries.some(([identifier, balance]) => {
    if (identifier === targetIdentifier) {
      return false;
    }
    // Contract-only (Soroban) balances are not swappable.
    if ("contractId" in balance) {
      return false;
    }
    // LiquidityPoolBalance carries no `token` property (its tokens live
    // under `reserves` instead) — this is what actually excludes LP shares,
    // not the contractId check above.
    if (!("token" in balance)) {
      return false;
    }
    if (isNativeToken(balance.token)) {
      return xlmLeftToSwap.gt(0);
    }
    if (!("issuer" in balance.token)) {
      return false;
    }
    return calculateSpendableAmount({ balance }).gt(0);
  });
};

export const getNotEnoughVariant = ({
  isOnrampable,
  isSwappable,
}: {
  isOnrampable: boolean;
  isSwappable: boolean;
}): NotEnoughVariant => {
  if (isOnrampable && isSwappable) {
    return NotEnoughVariant.BUY_SWAP_OR_TRANSFER;
  }
  if (isOnrampable) {
    return NotEnoughVariant.BUY_OR_TRANSFER;
  }
  if (isSwappable) {
    return NotEnoughVariant.SWAP_OR_TRANSFER;
  }
  return NotEnoughVariant.TRANSFER_ONLY;
};
