import { NETWORKS, NETWORK_URLS } from "config/constants";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import { getIconUrlFromTokensLists } from "helpers/getIconUrlFromTokensLists";

export const getIconUrl = async ({
  asset,
  network,
}: {
  asset: {
    issuer?: string;
    contractId?: string;
    code?: string;
  };
  network: NETWORKS;
}): Promise<string> => {
  const networkUrl = NETWORK_URLS[network];
  const iconFromList = await getIconUrlFromTokensLists({ asset, network });
  if (iconFromList) return iconFromList;

  if (asset.issuer && asset.code) {
    return getIconUrlFromIssuer({
      issuerKey: asset.issuer,
      tokenCode: asset.code,
      networkUrl,
    });
  }

  // same fallback case as getIconUrlFromIssuer
  return "";
};
