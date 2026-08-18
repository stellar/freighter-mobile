import { StellarExpertRecord } from "components/screens/SwapScreen/helpers/recordPredicates";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { getTokenType } from "helpers/balances";

/**
 * Format a stellar.expert classic-asset record into a FormattedSearchTokenRecord.
 *
 * Soroban contracts are filtered upstream on the swap surface, so this
 * formatter omits the contract branch.
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
