/* eslint-disable no-underscore-dangle */
import { NETWORKS } from "config/constants";
import { normalizeError } from "config/logger";
import { SearchTokenResponse } from "config/types";
import { getApiStellarExpertUrl } from "helpers/stellarExpert";
import {
  createApiService,
  isRequestCanceled,
  logApiError,
} from "services/apiFactory";

const stellarExpertApiTestnet = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.TESTNET),
});

const stellarExpertApiPublic = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.PUBLIC),
});

export const fetchTrendingAssets = async ({
  network,
  signal,
}: {
  network: NETWORKS;
  signal?: AbortSignal;
}) => {
  const stellarExpertApi =
    network === NETWORKS.TESTNET
      ? stellarExpertApiTestnet
      : stellarExpertApiPublic;

  // stellar.expert testnet always reports volume7d=0, so the
  // mainnet "sort by 7-day volume, take top 50" yields an arbitrary
  // ordering AND every record gets dropped by the downstream volume
  // filter. On testnet pull the unsorted first-page slice instead so
  // the trending section has something to show.
  const params =
    network === NETWORKS.TESTNET
      ? { limit: 50 }
      : { sort: "volume7d", order: "desc", limit: 50 };

  try {
    const response = await stellarExpertApi.get<SearchTokenResponse>("/asset", {
      params,
      signal,
    });

    if (!response.data || !response.data._embedded) {
      throw normalizeError(response);
    }

    return response.data;
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
  const stellarExpertApi =
    network === NETWORKS.TESTNET
      ? stellarExpertApiTestnet
      : stellarExpertApiPublic;

  try {
    const response = await stellarExpertApi.get<SearchTokenResponse>("/asset", {
      params: {
        search: token,
      },
      signal,
    });

    if (!response.data || !response.data._embedded) {
      throw normalizeError(response);
    }

    return response.data;
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
