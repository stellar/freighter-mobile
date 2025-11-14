import { NETWORKS, NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getNativeContractDetails } from "helpers/soroban";

/**
 * Splits tokens into verified and unverified based on verified token lists
 * Similar to splitVerifiedAssetCurrency in the extension
 * Uses cached verified tokens to avoid redundant API calls
 */
export const splitVerifiedTokens = async ({
  tokens,
  network,
}: {
  tokens: FormattedSearchTokenRecord[];
  network: NETWORKS;
}): Promise<{
  verified: FormattedSearchTokenRecord[];
  unverified: FormattedSearchTokenRecord[];
}> => {
  // Get verified tokens from cache (fetches if not cached or stale)
  const { getVerifiedTokens } = useVerifiedTokensStore.getState();
  const verifiedTokens = await getVerifiedTokens({ network });

  // Create a set of verified issuer and contract IDs
  const verifiedIds = new Set<string>();
  verifiedTokens.forEach((verifiedToken) => {
    if (verifiedToken.issuer) {
      verifiedIds.add(verifiedToken.issuer.toLowerCase());
    }
    if (verifiedToken.contract) {
      verifiedIds.add(verifiedToken.contract.toLowerCase());
    }
  });

  // Always add native token contract to verified list
  const nativeContractDetails = getNativeContractDetails(network);
  verifiedIds.add(nativeContractDetails.contract.toLowerCase());
  if (nativeContractDetails.issuer) {
    verifiedIds.add(nativeContractDetails.issuer.toLowerCase());
  }

  // Split tokens into verified and unverified
  const [verified, unverified] = tokens.reduce<
    [FormattedSearchTokenRecord[], FormattedSearchTokenRecord[]]
  >(
    ([verifiedList, unverifiedList], token) => {
      // Check if token's issuer matches any verified issuer or contract
      const tokenIssuer = token.issuer?.toLowerCase();
      if (tokenIssuer && verifiedIds.has(tokenIssuer)) {
        verifiedList.push(token);
        return [verifiedList, unverifiedList];
      }

      // For native tokens, always consider verified
      if (token.isNative || token.tokenCode === NATIVE_TOKEN_CODE) {
        verifiedList.push(token);
        return [verifiedList, unverifiedList];
      }

      // Token is not verified
      unverifiedList.push(token);
      return [verifiedList, unverifiedList];
    },
    [[], []],
  );

  return {
    verified,
    unverified,
  };
};
