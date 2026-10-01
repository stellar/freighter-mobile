import { TokenIdentifier } from "config/types";
import { isNativeAssetId, getNativeContractId } from "helpers/assetIdentity";
import { getTokenSacAddress, isContractId } from "helpers/soroban";

export const getCatalogContractId = (
  tokenId: TokenIdentifier,
  networkPassphrase: string,
): string | undefined => {
  if (!tokenId) return undefined;
  if (isNativeAssetId(tokenId)) return getNativeContractId(networkPassphrase);
  if (isContractId(tokenId)) return tokenId;

  const [code, issuer] = tokenId.split(":");
  if (!code || !issuer) return undefined;
  if (isContractId(issuer)) return issuer;

  try {
    return getTokenSacAddress(code, issuer, networkPassphrase);
  } catch {
    // Not a valid asset (bad code or issuer): the catalog cannot know it.
    return undefined;
  }
};
