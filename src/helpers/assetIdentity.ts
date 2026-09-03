import { Asset } from "@stellar/stellar-sdk";
import { Balance, NativeBalance, NativeToken, Token } from "config/types";

/**
 * Shared asset-identity predicates.
 *
 * Nativeness is a property of a token's type, or — in contract space — of
 * the contract id. Every native check in the app should go through one of
 * these predicates, or, for canonical identifier strings, through
 * `isNativeAssetId` in config/constants.
 */

/** True only for a token whose declared type is native. */
export const isNativeToken = (
  token: Token | undefined | null,
): token is NativeToken =>
  !!token && "type" in token && token.type === "native";

/** True only for a balance carrying a native-typed token. */
export const isNativeBalance = (balance: Balance): balance is NativeBalance =>
  "token" in balance && isNativeToken(balance.token);

/**
 * The native lumen's Stellar Asset Contract id, derived from the network
 * passphrase, so it is correct by construction on every network.
 */
export const getNativeContractId = (networkPassphrase: string): string =>
  Asset.native().contractId(networkPassphrase);

/** True only when `contractId` is the native SAC for the given network. */
export const isNativeContract = (
  contractId: string | undefined | null,
  networkPassphrase: string,
): boolean =>
  !!contractId && contractId === getNativeContractId(networkPassphrase);
