import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { createApiService } from "services/apiFactory";
import { DEFAULT_TOKENS_LISTS } from "services/verified-token-lists/constants";
import {
  TokenListReponseItem,
  TokenListResponse,
} from "services/verified-token-lists/types";

export const TOKEN_LISTS_API_SERVICES = {
  [NETWORKS.PUBLIC]: DEFAULT_TOKENS_LISTS.PUBLIC!.map(({ url }) =>
    createApiService({ baseURL: url }),
  ),
  [NETWORKS.TESTNET]: DEFAULT_TOKENS_LISTS.TESTNET!.map(({ url }) =>
    createApiService({ baseURL: url }),
  ),
};

export const fetchVerifiedTokens = async ({
  tokenListsApiServices,
  network,
}: {
  tokenListsApiServices: Partial<
    Record<NETWORKS, ReturnType<Awaited<typeof createApiService>>[]>
  >;
  network: NETWORKS;
}) => {
  const apiServices = tokenListsApiServices[network] || [];
  const assetListPromises = apiServices.map(async (service) => {
    try {
      const res = await service.get<TokenListResponse>("");
      return res.data;
    } catch (err) {
      logger.error(
        "fetchVerifiedTokens",
        `Error retrieving verified tokens from token list: ${service.getInstance().getUri()}`,
        err,
      );
      return null;
    }
  });

  const results = await Promise.allSettled(assetListPromises);
  // combine verified tokens across token lists.
  return results
    .filter(
      (res): res is PromiseFulfilledResult<TokenListResponse> =>
        res.status === "fulfilled" && res.value != null,
    )
    .reduce(
      (prev, curr) => prev.concat(curr.value.assets),
      [] as TokenListReponseItem[],
    );
};
