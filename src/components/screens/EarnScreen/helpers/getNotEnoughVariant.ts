import BigNumber from "bignumber.js";
import { NetworkDetails, NETWORKS } from "config/constants";
import { PricedBalanceMap } from "config/types";

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
 * `TRANSFER_ONLY` is not in the designs but is reachable — an empty account on
 * a non-onrampable asset has nothing to buy with and nothing to swap from.
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
 * Does the account hold anything it could swap into the target asset?
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
export const hasSwappableBalance = (
  balances: PricedBalanceMap,
  targetIdentifier: string,
) =>
  Object.entries(balances).some(([identifier, balance]) => {
    // Contract-only tokens are not swappable, and LP shares are not a token.
    if ("contractId" in balance) {
      return false;
    }
    if (!("token" in balance)) {
      return false;
    }
    const isNative = "type" in balance.token && balance.token.type === "native";
    if (!isNative && !("issuer" in balance.token)) {
      return false;
    }
    if (!new BigNumber(balance.total).gt(0)) {
      return false;
    }
    return identifier !== targetIdentifier;
  });

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
