/* eslint-disable no-underscore-dangle */
import { NETWORKS } from "config/constants";
import { SearchTokenResponse } from "config/types";
import { isRequestCanceled, logApiError } from "services/apiFactory";
import { freighterBackendV2 } from "services/backend";

/**
 * Query encoder for the search params: encodeURIComponent, plus `'`, which it
 * leaves raw. OkHttp (Android) re-encodes a raw `'` to `%27` on the way out,
 * so the query on the wire would no longer match the one axios signed into
 * the v2 auth JWT, and the backend would answer 401.
 */
const encodeQueryValue = (value: string | number) =>
  encodeURIComponent(value).replace(/'/g, "%27");

/**
 * Calls StellarExpert's /asset list (search and sorted lists) through
 * freighter-backend-v2, because on Mainnet that endpoint needs an API key
 * and only the backend holds ours. v2 caches each answer and returns
 * StellarExpert's body unchanged under `data`.
 */
const searchAssets = async (
  network: NETWORKS,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<SearchTokenResponse> => {
  const { data } = await freighterBackendV2.get<{ data: SearchTokenResponse }>(
    "/assets/search",
    {
      params: {
        // v2 serves PUBLIC and TESTNET only, so any network other than
        // Mainnet gets Testnet data.
        network:
          network === NETWORKS.PUBLIC ? NETWORKS.PUBLIC : NETWORKS.TESTNET,
        ...params,
      },
      paramsSerializer: { encode: encodeQueryValue },
      signal,
    },
  );

  if (!data?.data?._embedded) {
    throw new Error("Unexpected assets/search response shape");
  }

  return data.data;
};

export const fetchTrendingAssets = async ({
  network,
  signal,
}: {
  network: NETWORKS;
  signal?: AbortSignal;
}) => {
  // stellar.expert testnet always reports volume7d=0, so the
  // mainnet "sort by 7-day volume, take top 50" yields an arbitrary
  // ordering AND every record gets dropped by the downstream volume
  // filter. Off Mainnet, where searchAssets asks for Testnet data, pull
  // the unsorted first-page slice instead so the trending section has
  // something to show.
  const params: Record<string, string | number> =
    network === NETWORKS.PUBLIC
      ? { sort: "volume7d", order: "desc", limit: 50 }
      : { limit: 50 };

  try {
    return await searchAssets(network, params, signal);
  } catch (error) {
    if (isRequestCanceled(error)) {
      return null;
    }

    logApiError(
      "stellarExpert",
      "Network unreachable while fetching trending assets",
      "Error fetching trending assets",
      error,
    );

    return null;
  }
};

export const searchToken = async (
  token: string,
  network: NETWORKS,
  signal?: AbortSignal,
) => {
  try {
    return await searchAssets(network, { search: token }, signal);
  } catch (error) {
    if (isRequestCanceled(error)) {
      return null;
    }

    logApiError(
      "stellarExpert",
      "Network unreachable while searching token",
      "Error searching token",
      error,
    );

    return null;
  }
};
