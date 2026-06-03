import { NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord, SearchTokenResponse } from "config/types";
import { getTokenType } from "helpers/balances";

/**
 * Minimal shape we need from the stellar.expert /asset response.
 * Mirrors `SearchTokenResponse._embedded.records[number]` but kept loose
 * so consumers don't have to import the full shape just for typing.
 */
type StellarExpertRecord = SearchTokenResponse["_embedded"]["records"][number];

/**
 * Format a stellar.expert classic-asset record into a FormattedSearchTokenRecord.
 *
 * Mirrors path-3 of `useTokenLookup`'s formatter, but stripped of the
 * Soroban-contract branch since the swap surface filters those out
 * upstream.
 */
export const formatClassicRecord = (
  record: StellarExpertRecord,
  hasTrustline: boolean,
): FormattedSearchTokenRecord => {
  const [tokenCode, issuer] = record.asset.split("-");
  return {
    tokenCode,
    domain: record.domain ?? "",
    hasTrustline,
    iconUrl: record.tomlInfo?.image,
    issuer: issuer ?? "",
    isNative: record.asset === NATIVE_TOKEN_CODE,
    tokenType: getTokenType(
      issuer ? `${tokenCode}:${issuer}` : NATIVE_TOKEN_CODE,
    ),
    price: record.price,
  };
};
