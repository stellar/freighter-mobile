import { AxiosError } from "axios";
import { FREIGHTER_BACKEND_URL, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  BalanceMap,
  GetTokenDetailsParams,
  TokenDetailsResponse,
  TokenIdentifier,
  TokenPricesMap,
} from "config/types";
import { bigize } from "helpers/bigize";
import { getNativeContractDetails } from "helpers/soroban";
import { createApiService } from "services/apiFactory";

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
  const { data } = await freighterBackend.post<TokenPricesResponse>(
    "/token-prices",
    {
      tokens,
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
  shouldFetchBalance,
}: GetTokenDetailsParams): Promise<TokenDetailsResponse | null> => {
  try {
    // TODO: Add verification for custom network.

    const response = await freighterBackend.get<TokenDetailsResponse>(
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
