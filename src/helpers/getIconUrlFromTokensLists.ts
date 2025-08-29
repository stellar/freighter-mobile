import { NETWORKS } from "config/constants";
import {
  TOKEN_LISTS_API_SERVICES,
  fetchVerifiedTokens,
} from "services/verified-token-lists";

/**
 * Retrieves the icon URL for a given asset from verified Stellar token lists.
 *
 * This function searches through a set of verified token lists for a token
 * that matches either the asset's `contractId` or `issuer`. If a matching token
 * with an icon is found, the function returns the icon URL.
 *
 * @param {Object} params - Parameters for icon URL retrieval.
 * @param {Object} params.asset - The asset to find the icon for.
 * @param {string} [params.asset.contractId] - The contract ID of the asset (optional C Address).
 * @param {string} [params.asset.issuer] - The issuer of the asset (optional G address).
 * @param {NETWORKS} params.network - The Stellar network to use (e.g., PUBLIC, TESTNET).
 * @returns {Promise<string | undefined>} A promise that resolves to the token's icon URL if found, or `undefined` if no match exists.
 *
 * @example
 * const iconUrl = await getIconUrlFromTokensLists({
 *   asset: { contractId: "C...", issuer: "G..." },
 *   network: NETWORKS.PUBLIC
 * });
 */

export const getIconUrlFromTokensLists = async ({
  asset,
  network,
}: {
  asset: {
    issuer?: string;
    contractId?: string;
  };
  network: NETWORKS;
}) => {
  const { contractId, issuer } = asset;
  const verifiedTokens = await fetchVerifiedTokens({
    tokenListsApiServices: TOKEN_LISTS_API_SERVICES,
    network,
  });

  const match = verifiedTokens.find(
    (token) =>
      token?.icon &&
      ((contractId &&
        token.contract?.toLowerCase() === contractId.toLowerCase()) ||
        (issuer && token.issuer?.toLowerCase() === issuer.toLowerCase())),
  );

  return match?.icon;
};
