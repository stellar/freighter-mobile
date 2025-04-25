/* eslint-disable no-underscore-dangle */
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { SearchAssetResponse } from "config/types";
import { getApiStellarExpertUrl } from "helpers/stellarExpert";
import { createApiService } from "services/apiFactory";

const stellarExpertApiTestnet = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.TESTNET),
});

const stellarExpertApiPublic = createApiService({
  baseURL: getApiStellarExpertUrl(NETWORKS.PUBLIC),
});

export const searchAsset = async (asset: string, network: NETWORKS) => {
  const stellarExpertApi =
    network === NETWORKS.TESTNET
      ? stellarExpertApiTestnet
      : stellarExpertApiPublic;

  try {
    const response = await stellarExpertApi.get<SearchAssetResponse>("/asset", {
      params: {
        search: asset,
      },
    });

    if (!response.data || !response.data._embedded) {
      logger.error(
        "stellarExpertApi.searchAsset",
        "Invalid response from stellarExpert",
        response.data,
      );

      throw new Error("Invalid response from stellarExpert");
    }

    return response.data;
  } catch (error) {
    logger.error("stellarExpert", "Error searching asset", error);
    return null;
  }
};
