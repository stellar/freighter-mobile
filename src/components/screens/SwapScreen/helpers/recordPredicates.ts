import { recordTokenId } from "components/screens/SwapScreen/helpers/swapTokenHelpers";
import {
  FormattedSearchTokenRecord,
  PricedBalance,
  SearchTokenResponse,
  TokenTypeWithCustomToken,
} from "config/types";
import { isContractId } from "helpers/soroban";

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

/**
 * Either a held PricedBalance (carries `id`) or a non-held
 * FormattedSearchTokenRecord.
 */
export type SwapToListItem =
  | (PricedBalance & { id: string })
  | FormattedSearchTokenRecord;

/**
 * Type-guard discriminating a held PricedBalance from a stellar.expert
 * FormattedSearchTokenRecord. The `id` field is the structural witness
 * — only the balance variant carries it.
 */
export const isHeldToken = (
  item: SwapToListItem,
): item is PricedBalance & { id: string } => "id" in item;

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
