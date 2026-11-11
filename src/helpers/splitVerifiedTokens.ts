import { NETWORKS } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getNativeContractDetails } from "helpers/soroban";
import {
  buildVerifiedTokenIds,
  isTokenInVerifiedIds,
} from "helpers/verifiedTokenIds";

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

  // Always add the native token's identities to the verified set.
  const nativeContractDetails = getNativeContractDetails(network);
  const verifiedIds = buildVerifiedTokenIds([
    ...verifiedTokens,
    nativeContractDetails,
  ]);

  // Split tokens into verified and unverified
  const [verified, unverified] = tokens.reduce<
    [FormattedSearchTokenRecord[], FormattedSearchTokenRecord[]]
  >(
    ([verifiedList, unverifiedList], token) => {
      // Check if the token's code and issuer, or its contract, is verified
      if (isTokenInVerifiedIds(verifiedIds, token)) {
        verifiedList.push(token);
        return [verifiedList, unverifiedList];
      }

      // Native is always verified.
      if (token.isNative) {
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
