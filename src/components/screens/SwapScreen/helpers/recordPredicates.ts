import { SearchTokenResponse, TokenTypeWithCustomToken } from "config/types";
import { isContractId } from "helpers/soroban";

/**
 * One entry inside a stellar.expert /asset response. Aliased here so the
 * predicates + downstream helpers (formatClassicRecord,
 * computeTrendingIntersection) can share the same shape without each
 * redeclaring it.
 */
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
