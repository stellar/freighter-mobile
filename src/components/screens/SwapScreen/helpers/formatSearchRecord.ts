import {
  isSorobanRecord,
  StellarExpertRecord,
} from "components/screens/SwapScreen/helpers/recordPredicates";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { isNativeAssetId } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";
import { formatSorobanSearchRecord } from "helpers/formatSorobanSearchRecord";
import { truncateAddress } from "helpers/stellar";

/**
 * Format a stellar.expert record into a FormattedSearchTokenRecord. A Soroban
 * token's issuer is its contract ID, as in the balances map.
 */
export const formatSearchRecord = (
  record: StellarExpertRecord,
  hasTrustline: (tokenCode: string, issuer: string) => boolean,
): FormattedSearchTokenRecord => {
  if (isSorobanRecord(record)) {
    const formatted = formatSorobanSearchRecord(record, hasTrustline);
    return {
      ...formatted,
      // The picker row (and asset_code) shows a no-code token by its
      // shortened ID, as the extension does; Add token keeps the full ID.
      tokenCode:
        record.code || record.tomlInfo?.code || truncateAddress(record.asset),
      iconUrl: record.tomlInfo?.image,
      price: record.price,
    };
  }
  const [tokenCode, issuer] = record.asset.split("-");
  return {
    tokenCode,
    domain: record.domain ?? "",
    hasTrustline: hasTrustline(tokenCode, issuer ?? ""),
    iconUrl: record.tomlInfo?.image,
    issuer: issuer ?? "",
    isNative: isNativeAssetId(record.asset),
    tokenType: getTokenType(
      issuer ? `${tokenCode}:${issuer}` : NATIVE_TOKEN_CODE,
    ),
    price: record.price,
  };
};
