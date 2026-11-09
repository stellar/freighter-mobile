import {
  isSorobanRecord,
  StellarExpertRecord,
} from "components/screens/SwapScreen/helpers/recordPredicates";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { isNativeAssetId } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";

/**
 * Format a stellar.expert record into a FormattedSearchTokenRecord. A Soroban
 * token's issuer is its contract ID, as in the balances map.
 */
export const formatSearchRecord = (
  record: StellarExpertRecord,
  hasTrustline: (tokenCode: string, issuer: string) => boolean,
): FormattedSearchTokenRecord => {
  if (isSorobanRecord(record)) {
    const contractId = record.asset;
    const tokenCode = record.code ?? record.tomlInfo?.code ?? contractId;
    return {
      tokenCode,
      domain: record.domain ?? "",
      hasTrustline: hasTrustline(tokenCode, contractId),
      iconUrl: record.tomlInfo?.image,
      issuer: contractId,
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      decimals: record.decimals ?? record.tomlInfo?.decimals,
      name: record.token_name ?? record.tomlInfo?.name,
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
