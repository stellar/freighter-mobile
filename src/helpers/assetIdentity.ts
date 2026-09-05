import { Asset } from "@stellar/stellar-sdk";
import { HORIZON_NATIVE_ASSET_TYPE, NATIVE_TOKEN_CODE } from "config/constants";
import { Balance, NativeBalance, NativeToken, Token } from "config/types";

/**
 * Shared asset-identity predicates.
 *
 * Nativeness is a property of a token's type, or — in contract space — of
 * the contract id. Every native check in the app should go through one of
 * these predicates, including `isNativeAssetId` for canonical identifier
 * strings.
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
 * True if `id` refers to native XLM, matching both Horizon's raw "native"
 * sentinel and the normalized NATIVE_TOKEN_CODE ("XLM").
 */
export const isNativeAssetId = (id: string | undefined | null): boolean =>
  id === HORIZON_NATIVE_ASSET_TYPE || id === NATIVE_TOKEN_CODE;

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

/**
 * Native test for a raw code/issuer pair. Use it only where neither a token
 * type nor a contract id is available — the native asset carries the native
 * code and no issuer, so both halves are required.
 */
export const isNativeAssetPair = (
  code: string | undefined | null,
  issuer: string | undefined | null,
): boolean => code === NATIVE_TOKEN_CODE && !issuer;
