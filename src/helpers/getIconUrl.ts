import { logos } from "assets/logos";
import {
  CIRCLE_USDC_CONTRACT,
  CIRCLE_USDC_ISSUER,
  NETWORKS,
  NETWORK_URLS,
  USDC_CODE,
} from "config/constants";
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
  // Special case: Circle USDC on mainnet - use local bundled icon
  if (
    network === NETWORKS.PUBLIC &&
    asset.code === USDC_CODE &&
    (asset.issuer === CIRCLE_USDC_ISSUER ||
      asset.contractId === CIRCLE_USDC_CONTRACT)
  ) {
    return logos.usdc as unknown as string;
  }

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
