/* eslint-disable arrow-body-style */
import { Horizon, TransactionBuilder } from "@stellar/stellar-sdk";
import { AxiosError } from "axios";
import {
  FREIGHTER_BACKEND_URL,
  NetworkDetails,
  NETWORKS,
} from "config/constants";
import { logger } from "config/logger";
import {
  AssetTypeWithCustomToken,
  BalanceMap,
  FormattedSearchAssetRecord,
  GetTokenDetailsParams,
  TokenDetailsResponse,
  TokenIdentifier,
  TokenPricesMap,
} from "config/types";
import { getAssetType } from "helpers/balances";
import { bigize } from "helpers/bigize";
import { getNativeContractDetails } from "helpers/soroban";
import { createApiService } from "services/apiFactory";
import type {
  ScanSiteParams,
  ScanAssetParams,
  ScanTxParams,
  BlockAidScanSiteResult,
  BlockAidScanAssetResult,
  BlockAidScanTxResult,
} from "types/blockaid";

// Create a dedicated API service for backend operations
const freighterBackend = createApiService({
  baseURL: FREIGHTER_BACKEND_URL,
});

export type FetchBalancesResponse = {
  balances?: BalanceMap;
  isFunded?: boolean;
  subentryCount?: number;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  error?: { horizon: any; soroban: any };
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

type FetchBalancesParams = {
  publicKey: string;
  network: NETWORKS;
  contractIds?: string[];
};

export const fetchBalances = async ({
  publicKey,
  network,
  contractIds,
}: FetchBalancesParams): Promise<FetchBalancesResponse> => {
  const params = new URLSearchParams({
    network,
  });

  if (contractIds?.length) {
    contractIds.forEach((id) => {
      params.append("contract_ids", id);
    });
  }

  const { data } = await freighterBackend.get<FetchBalancesResponse>(
    `/account-balances/${publicKey}?${params.toString()}`,
  );

  let bigizedBalances: BalanceMap | undefined;
  if (data.balances) {
    // transform properties that type declarations expect to be BigNumber
    // instead of number/string as it originally comes from the API
    bigizedBalances = bigize(data.balances, [
      "available",
      "total",
      "limit",
      "minimumBalance",
      "numAccounts",
      "amount",
      "bidCount",
      "askCount",
      "spread",
    ]);

    // Convert native balance identifier to "XLM" for consistency
    if (bigizedBalances.native) {
      bigizedBalances.XLM = bigizedBalances.native;
      delete bigizedBalances.native;
    }
  }

  return {
    ...data,
    balances: bigizedBalances,
  };
};

/**
 * Response from the token prices API
 */
interface TokenPricesResponse {
  data: TokenPricesMap;
}

/**
 * Request parameters for fetching token prices
 */
export interface FetchTokenPricesParams {
  /** Array of token identifiers to fetch prices for */
  tokens: TokenIdentifier[];
}

/**
 * NOTE: This is a FAKE implementation that returns random data after a 1-second delay
 * Simulates fetching the current USD prices and 24h percentage changes for the specified tokens
 *
 * @param params Object containing the list of tokens to fetch prices for
 * @returns Promise resolving to a map of token identifiers to their price information
 *
 * @example
 * // Fetch prices for XLM and USDC
 * const prices = await fetchTokenPrices({
 *   tokens: [
 *     "XLM",
 *     "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 *   ]
 * });
 *
 * // Access individual token prices
 * const xlmPrice = prices["XLM"];
 * console.log(`XLM price: $${xlmPrice.currentPrice} (${xlmPrice.percentagePriceChange24h}% 24h change)`);
 */
export const fetchTokenPrices = async ({
  tokens,
}: FetchTokenPricesParams): Promise<TokenPricesMap> => {
  // NOTE: API does not accept LP IDs or custom tokens
  const filteredTokens = tokens.filter((tokenId) => {
    const asset = getAssetType(tokenId);
    return (
      asset !== AssetTypeWithCustomToken.LIQUIDITY_POOL_SHARES &&
      asset !== AssetTypeWithCustomToken.CUSTOM_TOKEN
    );
  });

  const { data } = await freighterBackend.post<TokenPricesResponse>(
    "/token-prices",
    {
      tokens: filteredTokens,
    },
  );

  /*
  // ========================================================
  // Uncomment this to simulate token-prices response
  // This may be useful for testing the UI with token prices on Testnet
  // as the /token-prices endpoint only returns prices for Mainnet

  // Simulate network delay
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, 500));

  // This is the backend interface for the prices map
  // We'll convert those values to BigNumber for convenience
  const pricesMap: {
     [tokenIdentifier: TokenIdentifier]: {
       currentPrice: string | null;
       percentagePriceChange24h: number | null;
     };
   } = {};

  tokens.forEach((token) => {
    // Special case for stablecoin
    if (token.includes("USD")) {
      pricesMap[token] = {
        currentPrice: (0.99 + Math.random() * 0.02).toFixed(6), // Between 0.99 and 1.01
        percentagePriceChange24h: Math.random() * 0.2 - 0.1, // Between -0.1% and +0.1%
      };
    } else {
      pricesMap[token] = {
        currentPrice: (0.001 + Math.random() * 99.999).toFixed(6), // Random number between 0.001 and 100,
        percentagePriceChange24h: Math.random() * 10 - 5, // Random number between -5 and 5
      };
    }
  });

  //========================================================
  */

  // Make sure it's compliant with the TokenPricesMap type as the backend
  // returns { "code:issuer" : null } for tokens that are not supported
  const pricesMap = data.data;
  tokens.forEach((token) => {
    if (!pricesMap[token]) {
      pricesMap[token] = {
        currentPrice: null,
        percentagePriceChange24h: null,
      };
    }
  });

  // Make sure to convert the response values to BigNumber for convenience
  return bigize(pricesMap, ["currentPrice", "percentagePriceChange24h"]);
};

export const getTokenDetails = async ({
  contractId,
  publicKey,
  network,
}: GetTokenDetailsParams): Promise<TokenDetailsResponse | null> => {
  try {
    // TODO: Add verification for custom network.

    const response = await freighterBackend.get<TokenDetailsResponse>(
      `/token-details/${contractId}`,
      {
        params: {
          pub_key: publicKey,
          network,
        },
      },
    );

    if (!response.data) {
      logger.error(
        "backendApi.getTokenDetails",
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
      "backendApi.getTokenDetails",
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
    const response = await freighterBackend.get<{ isSacContract: boolean }>(
      `/is-sac-contract/${contractId}`,
      {
        params: {
          network,
        },
      },
    );

    if (!response.data) {
      logger.error(
        "backendApi.isSacContractExecutable",
        "Invalid response from indexer",
        response.data,
      );
      throw new Error("Invalid response from indexer");
    }

    return response.data.isSacContract;
  } catch (error) {
    logger.error(
      "backendApi.isSacContractExecutable",
      "Error fetching sac contract executable",
      error,
    );
    return false;
  }
};

export const getIndexerAccountHistory = async ({
  publicKey,
  networkDetails,
}: {
  publicKey: string;
  networkDetails: NetworkDetails;
}): Promise<Horizon.ServerApi.OperationRecord[]> => {
  try {
    const response = await freighterBackend.get<
      Horizon.ServerApi.OperationRecord[]
    >(`/account-history/${publicKey}`, {
      params: {
        network: networkDetails.network,
        is_failed_included: true,
      },
    });

    if (!response.data) {
      throw new Error("Invalid response from backend");
    }

    return response.data;
  } catch (error) {
    logger.error(
      "backendApi.getAccountHistory",
      "Error fetching account history",
      error,
    );
    return [];
  }
};

export const getAccountHistory = async ({
  publicKey,
  networkDetails,
}: {
  publicKey: string;
  networkDetails: NetworkDetails;
}): Promise<Horizon.ServerApi.OperationRecord[]> =>
  // TODO: Add verification for custom network.
  getIndexerAccountHistory({
    publicKey,
    networkDetails,
  });

export const handleContractLookup = async (
  contractId: string,
  network: NETWORKS,
  publicKey?: string,
): Promise<FormattedSearchAssetRecord | null> => {
  const nativeContractDetails = getNativeContractDetails(network);

  if (nativeContractDetails.contract === contractId) {
    return {
      assetCode: nativeContractDetails.code,
      domain: nativeContractDetails.domain,
      hasTrustline: true,
      issuer: nativeContractDetails.issuer,
      isNative: true,
      assetType: AssetTypeWithCustomToken.NATIVE,
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

  const issuer = isSacContract
    ? (tokenDetails.name.split(":")[1] ?? "")
    : contractId;

  return {
    assetCode: tokenDetails.symbol,
    domain: "Stellar Network",
    hasTrustline: false,
    issuer,
    isNative: false,
    assetType: isSacContract
      ? getAssetType(contractId)
      : AssetTypeWithCustomToken.CUSTOM_TOKEN,
    decimals: tokenDetails.decimals,
    name: tokenDetails.name,
  };
};

export interface SimulateTokenTransferParams {
  address: string;
  pub_key: string;
  memo: string;
  fee?: string;
  params: {
    publicKey: string;
    destination: string;
    amount: string;
  };
  network_url: string;
  network_passphrase: string;
}

export interface SimulateTransactionResponse {
  simulationResponse: unknown;
  preparedTransaction: string;
}

export const simulateTokenTransfer = async (
  params: SimulateTokenTransferParams,
) => {
  const { data } = await freighterBackend.post<SimulateTransactionResponse>(
    "/simulate-token-transfer",
    params,
  );

  return {
    ...data,
    preparedTx: TransactionBuilder.fromXDR(
      data.preparedTransaction,
      params.network_passphrase,
    ),
  };
};

// ==================== BLOCKAID ENDPOINTS ====================

export const scanSiteBackend = async (
  params: ScanSiteParams,
): Promise<BlockAidScanSiteResult | null> => {
  try {
    logger.info("backend.scanSite", "Starting backend site scan", {
      url: params.url,
    });

    const { data } = await freighterBackend.post<BlockAidScanSiteResult>(
      "/blockaid/scan-site",
      {
        url: params.url,
      },
    );

    logger.info("backend.scanSite", "Backend site scan completed successfully");
    return data;
  } catch (error) {
    logger.error("backend.scanSite", "Backend site scan failed", error);
    return null;
  }
};

export const scanAssetBackend = async (
  params: ScanAssetParams,
): Promise<BlockAidScanAssetResult | null> => {
  try {
    logger.info("backend.scanAsset", "Starting backend asset scan", {
      assetCode: params.assetCode,
      network: params.network,
    });

    const { data } = await freighterBackend.post<BlockAidScanAssetResult>(
      "/blockaid/scan-asset",
      {
        assetCode: params.assetCode,
        assetIssuer: params.assetIssuer,
        network: params.network,
      },
    );

    logger.info(
      "backend.scanAsset",
      "Backend asset scan completed successfully",
    );
    return data;
  } catch (error) {
    logger.error("backend.scanAsset", "Backend asset scan failed", error);
    return null;
  }
};

export const scanTransactionBackend = async (
  params: ScanTxParams,
): Promise<BlockAidScanTxResult | null> => {
  try {
    logger.info(
      "backend.scanTransaction",
      "Starting backend transaction scan",
      {
        network: params.network,
        sourceAccount: `${params.sourceAccount.slice(0, 10)}...`,
      },
    );

    const { data } = await freighterBackend.post<BlockAidScanTxResult>(
      "/blockaid/scan-transaction",
      {
        xdr: params.xdr,
        sourceAccount: params.sourceAccount,
        network: params.network,
      },
    );

    logger.info(
      "backend.scanTransaction",
      "Backend transaction scan completed successfully",
    );
    return data;
  } catch (error) {
    logger.error(
      "backend.scanTransaction",
      "Backend transaction scan failed",
      error,
    );
    return null;
  }
};
