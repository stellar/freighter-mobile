import { NETWORKS } from "config/constants";
import { TokensLists } from "services/verified-token-lists/types";

export const DEFAULT_TOKENS_LISTS: Partial<TokensLists> = {
  [NETWORKS.PUBLIC]: [
    {
      url: "https://api.stellar.expert/explorer/public/asset-list/top50",
      isEnabled: true,
    },
    {
      url: "https://raw.githubusercontent.com/soroswap/token-list/main/tokenList.json",
      isEnabled: true,
    },
    {
      url: "https://lobstr.co/api/v1/sep/assets/curated.json",
      isEnabled: true,
    },
  ],
  [NETWORKS.TESTNET]: [
    {
      url: "https://api.stellar.expert/explorer/testnet/asset-list/top50",
      isEnabled: true,
    },
  ],
};
