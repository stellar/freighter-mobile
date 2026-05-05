import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { createApiService, isApiNetworkError } from "services/apiFactory";
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
      // Connectivity failures (offline, DNS, TLS, captive portal) are not
      // backend bugs — demote to warn so they remain as breadcrumb context
      // without creating top-level Sentry issues. Real failures (4xx/5xx
      // responses, malformed payloads) still surface as logger.error.
      //
      // Keep the per-list URL out of the message and pass it as a
      // structured arg instead — interpolating it would fragment Sentry
      // grouping into one issue per token-list URL.
      const url = service.getInstance().getUri();
      if (isApiNetworkError(err)) {
        logger.warn(
          "fetchVerifiedTokens",
          "Network unreachable for token list",
          {
            url,
          },
        );
      } else {
        logger.error(
          "fetchVerifiedTokens",
          "Error retrieving verified tokens from token list",
          err,
          { url },
        );
      }
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
