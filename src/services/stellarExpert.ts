/* eslint-disable no-underscore-dangle */
import { NETWORKS } from "config/constants";
import { logger, normalizeError } from "config/logger";
import { SearchTokenResponse } from "config/types";
import { getApiStellarExpertUrl } from "helpers/stellarExpert";
import { createApiService } from "services/apiFactory";

const stellarExpertApiTestnet = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.TESTNET),
});

const stellarExpertApiPublic = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.PUBLIC),
});

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
    if (error instanceof Error && error.message === "canceled") {
      return null;
    }
    logger.error("stellarExpert", "Error searching token", error);

    return null;
  }
};
