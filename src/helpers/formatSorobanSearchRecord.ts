import {
  FormattedSearchTokenRecord,
  SearchTokenResponse,
  TokenTypeWithCustomToken,
} from "config/types";

/**
 * Formats a stellar.expert record whose `asset` is a contract ID. The icon is
 * left to the caller. Metadata comes from the top-level fields, with tomlInfo
 * as fallback.
 */
export const formatSorobanSearchRecord = (
  record: SearchTokenResponse["_embedded"]["records"][number],
  hasTrustline: (tokenCode: string, contractId: string) => boolean,
): Omit<FormattedSearchTokenRecord, "iconUrl"> => {
  const contractId = record.asset;
  const tokenCode = record.code ?? record.tomlInfo?.code ?? contractId;
  return {
    tokenCode,
    domain: record.domain ?? "",
    hasTrustline: hasTrustline(tokenCode, contractId),
    issuer: contractId,
    isNative: false,
    tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    decimals: record.decimals ?? record.tomlInfo?.decimals,
    name: record.token_name ?? record.tomlInfo?.name,
  };
};
