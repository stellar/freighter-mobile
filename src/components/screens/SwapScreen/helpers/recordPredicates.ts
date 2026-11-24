import { recordTokenId } from "components/screens/SwapScreen/helpers/swapTokenHelpers";
import {
  FormattedSearchTokenRecord,
  SearchTokenResponse,
  TokenTypeWithCustomToken,
} from "config/types";
import { isNativeAssetId } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import { type HeldBalanceItem } from "hooks/useBalancesList";

/** One entry inside a stellar.expert /asset response. */
export type StellarExpertRecord =
  SearchTokenResponse["_embedded"]["records"][number];

/**
 * Returns true when a stellar.expert record is a Soroban contract token
 * (raw contract ID in `asset`). Classic records use "CODE-ISSUER-TYPE".
 */
export const isSorobanRecord = (record: StellarExpertRecord): boolean =>
  isContractId(record.asset);

/**
 * Returns true when a (formatted) token is classic — i.e. not a Soroban
 * custom token and has a structurally valid issuer (G…).
 */
export const isClassicTokenType = (
  tokenType: TokenTypeWithCustomToken | undefined,
): boolean =>
  tokenType === TokenTypeWithCustomToken.NATIVE ||
  tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
  tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM12;

/** Classic tokens and Soroban contract tokens; not liquidity pool shares. */
export const isSwappableTokenType = (
  tokenType: TokenTypeWithCustomToken | undefined,
): boolean =>
  isClassicTokenType(tokenType) ||
  tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN;

/** A stellar.expert record the swap picker can list. */
export const isSwappableRecord = (record: StellarExpertRecord): boolean => {
  if (isSorobanRecord(record)) return true;
  const [tokenCode, issuer] = record.asset.split("-");
  if (!issuer) return isNativeAssetId(record.asset);
  return isClassicTokenType(getTokenType(`${tokenCode}:${issuer}`));
};

/**
 * Either a held PricedBalance (carries `id`) or a non-held
 * FormattedSearchTokenRecord.
 */
export type SwapToListItem = HeldBalanceItem | FormattedSearchTokenRecord;

/**
 * Type-guard discriminating a held PricedBalance from a stellar.expert
 * FormattedSearchTokenRecord. The `id` field is the structural witness
 * — only the balance variant carries it.
 */
export const isHeldToken = (item: SwapToListItem): item is HeldBalanceItem =>
  "id" in item;

/**
 * Stable list-row key: held tokens use their balance id; non-held search
 * records use the canonical "CODE:ISSUER" string from recordTokenId.
 */
export const getItemKey = (item: SwapToListItem): string => {
  if (isHeldToken(item)) {
    return item.id;
  }
  return recordTokenId(item);
};
