/* eslint-disable no-underscore-dangle */
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { SearchAssetResponse } from "config/types";
import { getApiStellarExpertUrl } from "helpers/stellarExpert";
import { createApiService } from "services/apiFactory";

export const searchAsset = async (asset: string, network: NETWORKS) => {
  const stellarExpertApi = createApiService({
    baseURL: getApiStellarExpertUrl(network),
  });

  try {
    const response = await stellarExpertApi.get<SearchAssetResponse>(
      `/asset?search=${asset}`,
    );

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
