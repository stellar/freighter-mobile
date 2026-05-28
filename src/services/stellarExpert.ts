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

  try {
    const response = await stellarExpertApi.get<SearchTokenResponse>("/asset", {
      params: { sort: "volume7d", order: "desc", limit: 50 },
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
