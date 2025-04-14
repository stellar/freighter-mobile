/* eslint-disable no-underscore-dangle */
import { AxiosError } from "axios";
import { INDEXER_URL, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { GetTokenDetailsParams, TokenDetailsResponse } from "config/types";
import { getNativeContractDetails } from "helpers/soroban";
import { createApiService } from "services/apiFactory";

const indexerApi = createApiService({
  baseURL: INDEXER_URL,
});

export const getTokenDetails = async ({
  contractId,
  publicKey,
  network,
  shouldFetchBalance,
}: GetTokenDetailsParams): Promise<TokenDetailsResponse | null> => {
  try {
    // TODO: Add verification for custom network.

    const response = await indexerApi.get<TokenDetailsResponse>(
      `/token-details/${contractId}`,
      {
        params: {
          pub_key: publicKey,
          network,
          shouldFetchBalance: shouldFetchBalance ? "true" : "false",
        },
      },
    );

    if (!response.data) {
      logger.error(
        "indexerApi.getTokenDetails",
        "Invalid response from indexer",
        response.data,
      );
      throw new Error("Invalid response from indexer");
    }

    return response.data;
  } catch (error) {
    if ((error as AxiosError).status === 400) {
      // That means the contract is not a SAC token.
      return null;
    }

    logger.error(
      "indexerApi.getTokenDetails",
      "Error fetching token details",
      error,
    );
    return null;
  }
};

export const isSacContractExecutable = async (
  contractId: string,
  network: NETWORKS,
) => {
  // TODO: Add verification for custom network.

  try {
    const response = await indexerApi.get<{ isSacContract: boolean }>(
      `/is-sac-contract/${contractId}`,
      {
        params: {
          network,
        },
      },
    );

    if (!response.data) {
      logger.error(
        "indexerApi.isSacContractExecutable",
        "Invalid response from indexer",
        response.data,
      );
      throw new Error("Invalid response from indexer");
    }

    return response.data.isSacContract;
  } catch (error) {
    logger.error(
      "indexerApi.isSacContractExecutable",
      "Error fetching sac contract executable",
      error,
    );
    return false;
  }
};

export const handleContractLookup = async (
  contractId: string,
  network: NETWORKS,
  publicKey?: string,
) => {
  const nativeContractDetails = getNativeContractDetails(network);

  if (nativeContractDetails.contract === contractId) {
    return {
      assetCode: nativeContractDetails.code,
      domain: nativeContractDetails.domain,
      hasTrustline: true,
      issuer: nativeContractDetails.issuer,
      isNative: true,
    };
  }

  const tokenDetails = await getTokenDetails({
    contractId,
    publicKey: publicKey ?? "",
    network,
  });

  if (!tokenDetails) {
    return null;
  }

  const isSacContract = await isSacContractExecutable(contractId, network);

  return {
    assetCode: tokenDetails.symbol,
    domain: "Stellar Network",
    hasTrustline: false,
    issuer: isSacContract
      ? (tokenDetails.name.split(":")[1] ?? "")
      : contractId,
    isNative: false,
  };
};
