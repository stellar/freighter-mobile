/**
 * Backend Service Module
 * @fileoverview API service functions for interacting with Freighter backend services
 *
 * This module provides functions for:
 * - Account balance fetching and transformation
 * - Token price retrieval and caching
 * - Token details and contract validation
 * - Account history retrieval
 * - Protocol discovery and filtering
 * - Transaction simulation
 *
 * All functions handle error scenarios gracefully and provide consistent
 * data transformation (e.g., BigNumber conversion via bigize helper).
 */
/* eslint-disable arrow-body-style */
import { Horizon, TransactionBuilder } from "@stellar/stellar-sdk";
import { AxiosError } from "axios";
import { NetworkDetails, NETWORKS } from "config/constants";
import { BackendEnvConfig } from "config/envConfig";
import { logger, normalizeError } from "config/logger";
import {
  TokenTypeWithCustomToken,
  BalanceMap,
  FormattedSearchTokenRecord,
  GetTokenDetailsParams,
  DiscoverProtocol,
  TokenDetailsResponse,
  TokenIdentifier,
  TokenPricesMap,
} from "config/types";
import { getTokenType } from "helpers/balances";
import { bigize } from "helpers/bigize";
import { getNativeContractDetails } from "helpers/soroban";
import { createApiService, isRequestCanceled } from "services/apiFactory";

// Create dedicated API services for backend operations
export const freighterBackendV1 = createApiService({
  baseURL: BackendEnvConfig.FREIGHTER_BACKEND_V1_URL,
});
export const freighterBackendV2 = createApiService({
  baseURL: BackendEnvConfig.FREIGHTER_BACKEND_V2_URL,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fetches the Soroban contract specification (JSON Schema) from the backend.
 *
 * The returned object contains a `definitions` map for contract functions and types.
 * Function entries expose an `args` object with a positional `required` array that we
 * use to label parameters in the UI. Some specs may also include a top-level
 * `$schema` field; we forward the backend payload as-is.
 *
 * @async
 * @function getContractSpecs
 * @param {Object} params - Request parameters
 * @param {string} params.contractId - Soroban contract ID (hex-encoded)
 * @param {NetworkDetails} params.networkDetails - Target network details
 * @returns {Promise<Record<string, any>>} Contract spec JSON schema
 * @throws {Error} If the backend responds with an error or an invalid payload
 *
 * @example
 * // Access positional argument names for a function
 * const spec = await getContractSpecs({ contractId: "CC...", networkDetails });
 * const argNames = spec.definitions["transfer"].properties.args.required; // ["from", "to", "amount"]
 *
 * @example
 * // Pool contract function (e.g., swap_chained)
 * const required = spec.definitions["swap_chained"].properties.args.required;
 * // ["user", "swaps_chain", "token_in", "in_amount", "out_min"]
 *
 * @example
 * // Sample (trimmed) response for a token-like contract
 * {
 *   "definitions": {
 *     "transfer": {
 *       "properties": {
 *         "args": {
 *           "type": "object",
 *           "required": ["from", "to", "amount"],
 *           "additionalProperties": false,
 *           "properties": {
 *             "from": { "$ref": "#/definitions/Address" },
 *             "to": { "$ref": "#/definitions/Address" },
 *             "amount": { "$ref": "#/definitions/I128" }
 *           }
 *         }
 *       },
 *       "additionalProperties": false
 *     },
 *     "balance": {
 *       "properties": {
 *         "args": {
 *           "type": "object",
 *           "required": ["id"],
 *           "additionalProperties": false,
 *           "properties": {
 *             "id": { "$ref": "#/definitions/Address" }
 *           }
 *         }
 *       },
 *       "additionalProperties": false
 *     },
 *     "Address": { "type": "string" },
 *     "I128": { "type": "string" }
 *   }
 * }
 */
export const getContractSpecs = async ({
  contractId,
  networkDetails,
}: {
  contractId: string;
  networkDetails: NetworkDetails;
}): Promise<Record<string, any>> => {
  const response = await freighterBackendV1.get<{ data: Record<string, any> }>(
    `/contract-spec/${contractId}`,
    {
      params: {
        network: networkDetails.network,
      },
    },
  );

  const payload = response.data;

  if (!payload || !payload.data) {
    throw normalizeError(payload);
  }

  return payload.data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Response type for account balance fetching
 * @typedef {Object} FetchBalancesResponse
 * @property {BalanceMap} [balances] - Map of account balances by token
 * @property {boolean} [isFunded] - Whether the account is funded
 * @property {number} [subentryCount] - Number of subentries on the account
 * @property {Object} [error] - Error information from horizon/soroban
 * @property {any} error.horizon - Horizon-specific error details
 * @property {any} error.soroban - Soroban-specific error details
 */
export type FetchBalancesResponse = {
  balances?: BalanceMap;
  isFunded?: boolean;
  subentryCount?: number;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  error?: { horizon: any; soroban: any };
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

/**
 * Parameters for fetching account balances
 * @typedef {Object} FetchBalancesParams
 * @property {string} publicKey - The public key of the account
 * @property {NETWORKS} network - The network to query (mainnet/testnet)
 * @property {string[]} [contractIds] - Optional contract IDs to include in balance calculation
 */
type FetchBalancesParams = {
  publicKey: string;
  network: NETWORKS;
  contractIds?: string[];
};

/**
 * Fetches account balances from the backend API
 * @async
 * @function fetchBalances
 * @param {FetchBalancesParams} params - Parameters for balance fetching
 * @param {string} params.publicKey - The public key of the account
 * @param {NETWORKS} params.network - The network to query (mainnet/testnet)
 * @param {string[]} [params.contractIds] - Optional contract IDs to include
 * @returns {Promise<FetchBalancesResponse>} Promise resolving to account balance data
 *
 * @description
 * Fetches account balances from the backend and transforms the response:
 * - Converts numeric values to BigNumber for precision
 * - Handles native balance conversion (native → XLM)
 * - Supports optional contract ID filtering
 * - Preserves error information from horizon/soroban
 *
 * @throws {Error} When the API request fails
 *
 * @example
 * ```ts
 * const balances = await fetchBalances({
 *   publicKey: "GABC...",
 *   network: NETWORKS.PUBLIC,
 *   contractIds: ["contract123"]
 * });
 * ```
 */
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

  const { data } = await freighterBackendV1.get<FetchBalancesResponse>(
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
 * @interface TokenPricesResponse
 * @property {TokenPricesMap} data - Map of token identifiers to price information
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
    const token = getTokenType(tokenId);
    return (
      token !== TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES &&
      token !== TokenTypeWithCustomToken.CUSTOM_TOKEN
    );
  });

  const { data } = await freighterBackendV1.post<TokenPricesResponse>(
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

/**
 * Fetches detailed information about a specific token contract
 * @async
 * @function getTokenDetails
 * @param {GetTokenDetailsParams} params - Parameters for token details fetching
 * @returns {Promise<TokenDetailsResponse | null>} Promise resolving to token details or null if not found
 *
 * @description
 * Retrieves comprehensive token information from the backend:
 * - Token symbol, name, and decimals
 * - Contract validation and type detection
 * - Handles both SAC and custom token contracts
 * - Returns null for non-token contracts (400 status)
 *
 * @throws {Error} When the API request fails (except 400 status)
 *
 * @example
 * ```ts
 * const tokenDetails = await getTokenDetails({
 *   contractId: "contract123",
 *   publicKey: "GABC...",
 *   network: NETWORKS.PUBLIC
 * });
 * ```
 */
export const getTokenDetails = async ({
  contractId,
  publicKey,
  network,
  signal,
}: GetTokenDetailsParams): Promise<TokenDetailsResponse | null> => {
  try {
    // TODO: Add verification for custom network.

    const response = await freighterBackendV1.get<TokenDetailsResponse>(
      `/token-details/${contractId}`,
      {
        params: {
          pub_key: publicKey,
          network,
        },
        signal,
      },
    );

    if (!response.data) {
      throw normalizeError(response);
    }

    return response.data;
  } catch (error) {
    if ((error as AxiosError).status === 400) {
      // That means the contract is not SEP-41 compliant.
      return null;
    }

    if (!isRequestCanceled(error)) {
      logger.error(
        "backendApi.getTokenDetails",
        "Error fetching token details",
        error,
      );
    }

    return null;
  }
};

/**
 * Checks if a contract is a Stellar Asset Contract (SAC)
 * @async
 * @function isSacContractExecutable
 * @param {string} contractId - The contract ID to check
 * @param {NETWORKS} network - The network to query
 * @returns {Promise<boolean>} Promise resolving to true if contract is SAC, false otherwise
 *
 * @description
 * Validates whether a contract implements the Stellar Asset Contract interface:
 * - Checks contract executable status
 * - Determines if contract can be used for token operations
 * - Returns false on any error (graceful degradation)
 *
 * @throws {Error} When the API request fails (logged but not re-thrown)
 *
 * @example
 * ```ts
 * const isSac = await isSacContractExecutable("contract123", NETWORKS.PUBLIC);
 * if (isSac) {
 *   // Handle SAC token operations
 * }
 * ```
 */
export const isSacContractExecutable = async (
  contractId: string,
  network: NETWORKS,
) => {
  // TODO: Add verification for custom network.

  try {
    const response = await freighterBackendV1.get<{ isSacContract: boolean }>(
      `/is-sac-contract/${contractId}`,
      {
        params: {
          network,
        },
      },
    );

    if (!response.data) {
      throw normalizeError(response);
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

/**
 * Fetches account operation history from the indexer
 * @async
 * @function getIndexerAccountHistory
 * @param {Object} params - Parameters for history fetching
 * @param {string} params.publicKey - The public key of the account
 * @param {NetworkDetails} params.networkDetails - Network configuration details
 * @returns {Promise<Horizon.ServerApi.OperationRecord[]>} Promise resolving to operation records
 *
 * @description
 * Retrieves comprehensive account operation history:
 * - Includes both successful and failed operations
 * - Uses indexer for enhanced performance and data
 * - Returns empty array on error (graceful degradation)
 *
 * @throws {Error} When the API request fails (logged but not re-thrown)
 *
 * @example
 * ```ts
 * const history = await getIndexerAccountHistory({
 *   publicKey: "GABC...",
 *   networkDetails: { network: NETWORKS.PUBLIC, ... }
 * });
 * ```
 */
export const getIndexerAccountHistory = async ({
  publicKey,
  networkDetails,
}: {
  publicKey: string;
  networkDetails: NetworkDetails;
}): Promise<Horizon.ServerApi.OperationRecord[]> => {
  try {
    const response = await freighterBackendV1.get<
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

/**
 * Fetches account operation history (wrapper for indexer)
 * @async
 * @function getAccountHistory
 * @param {Object} params - Parameters for history fetching
 * @param {string} params.publicKey - The public key of the account
 * @param {NetworkDetails} params.networkDetails - Network configuration details
 * @returns {Promise<Horizon.ServerApi.OperationRecord[]>} Promise resolving to operation records
 *
 * @description
 * Wrapper function that delegates to getIndexerAccountHistory.
 * Currently uses the indexer for all account history requests.
 *
 * @example
 * ```ts
 * const history = await getAccountHistory({
 *   publicKey: "GABC...",
 *   networkDetails: { network: NETWORKS.PUBLIC, ... }
 * });
 * ```
 */
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

/**
 * Looks up contract details and formats them for display
 * @async
 * @function handleContractLookup
 * @param {string} contractId - The contract ID to look up
 * @param {NETWORKS} network - The network to query
 * @param {string} [publicKey] - Optional public key for token details
 * @returns {Promise<FormattedSearchTokenRecord | null>} Promise resolving to formatted asset record or null
 *
 * @description
 * Comprehensive contract lookup that handles multiple contract types:
 * - Native contracts (XLM, etc.)
 * - SAC (Stellar Asset Contract) tokens
 * - Custom tokens
 * - Returns null for unrecognized contracts
 *
 * @throws {Error} When API requests fail (logged but not re-thrown)
 *
 * @example
 * ```ts
 * const tokenRecord = await handleContractLookup(
 *   "contract123",
 *   NETWORKS.PUBLIC,
 *   "GABC..."
 * );
 * ```
 */
export const handleContractLookup = async (
  contractId: string,
  network: NETWORKS,
  publicKey?: string,
  signal?: AbortSignal,
): Promise<FormattedSearchTokenRecord | null> => {
  const nativeContractDetails = getNativeContractDetails(network);

  if (nativeContractDetails.contract === contractId) {
    return {
      tokenCode: nativeContractDetails.code,
      domain: nativeContractDetails.domain,
      hasTrustline: true,
      issuer: nativeContractDetails.issuer,
      isNative: true,
      tokenType: TokenTypeWithCustomToken.NATIVE,
    };
  }

  const tokenDetails = await getTokenDetails({
    contractId,
    publicKey: publicKey ?? "",
    network,
    signal,
  });

  if (!tokenDetails) {
    return null;
  }

  const isSacContract = await isSacContractExecutable(contractId, network);

  const issuer = isSacContract
    ? (tokenDetails.name.split(":")[1] ?? "")
    : contractId;

  return {
    tokenCode: tokenDetails.symbol,
    domain: "Stellar Network",
    hasTrustline: false,
    issuer,
    isNative: false,
    tokenType: isSacContract
      ? getTokenType(tokenDetails.name)
      : TokenTypeWithCustomToken.CUSTOM_TOKEN,
    decimals: tokenDetails.decimals,
    name: tokenDetails.name,
  };
};

/**
 * Parameters for token transfer simulation
 * @interface SimulateTokenTransferParams
 * @property {string} address - Contract address for the token
 * @property {string} pub_key - Public key of the sender
 * @property {string} memo - Transaction memo
 * @property {string} [fee] - Optional fee amount
 * @property {Object} params - Transfer parameters
 * @property {string} params.publicKey - Sender's public key
 * @property {string} params.destination - Recipient's address
 * @property {string} params.amount - Amount to transfer
 * @property {string} network_url - Network URL for simulation
 * @property {string} network_passphrase - Network passphrase
 */
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

/**
 * Response from token transfer simulation
 * @interface SimulateTransactionResponse
 * @property {unknown} simulationResponse - Raw simulation response from backend
 * @property {string} preparedTransaction - XDR-encoded prepared transaction
 */
export interface SimulateTransactionResponse {
  simulationResponse: unknown;
  preparedTransaction: string;
}

/**
 * Simulates a token transfer operation
 * @async
 * @function simulateTokenTransfer
 * @param {SimulateTokenTransferParams} params - Simulation parameters
 * @returns {Promise<Object>} Promise resolving to simulation result with prepared transaction
 *
 * @description
 * Simulates a token transfer to validate the operation:
 * - Validates transaction parameters
 * - Returns simulation response and prepared transaction
 * - Converts XDR to TransactionBuilder for easy manipulation
 *
 * @throws {Error} When the simulation fails
 *
 * @example
 * ```ts
 * const result = await simulateTokenTransfer({
 *   address: "contract123",
 *   pub_key: "GABC...",
 *   memo: "Transfer",
 *   params: {
 *     publicKey: "GABC...",
 *     destination: "GDEF...",
 *     amount: "100"
 *   },
 *   network_url: "https://horizon.stellar.org",
 *   network_passphrase: "Public Global Stellar Network"
 * });
 * ```
 */
export const simulateTokenTransfer = async (
  params: SimulateTokenTransferParams,
) => {
  const { data } = await freighterBackendV1.post<SimulateTransactionResponse>(
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

/**
 * Response from the protocols API
 * @interface ProtocolsResponse
 * @property {Object} data - Response data container
 * @property {Object[]} data.protocols - Array of protocol objects
 * @property {string} data.protocols[].description - Protocol description
 * @property {string} data.protocols[].icon_url - Protocol icon URL
 * @property {string} data.protocols[].name - Protocol name
 * @property {string} data.protocols[].website_url - Protocol website URL
 * @property {string[]} data.protocols[].tags - Protocol tags/categories
 * @property {boolean} [data.protocols[].is_blacklisted] - Whether protocol is blacklisted
 * @property {boolean} [data.protocols[].is_wc_not_supported] - Whether protocol supports WalletConnect
 */
interface ProtocolsResponse {
  data: {
    protocols: {
      description: string;
      icon_url: string;
      name: string;
      website_url: string;
      tags: string[];
      is_blacklisted?: boolean;
      is_wc_not_supported?: boolean;
    }[];
  };
}

/**
 * Fetches trending protocols from the backend protocols endpoint
 * @async
 * @function fetchProtocols
 * @returns {Promise<DiscoverProtocol[]>} Promise resolving to filtered array of protocols
 *
 * @description
 * Retrieves and filters protocols from the backend:
 * - Fetches all protocols from the /protocols endpoint
 * - Filters out blacklisted protocols (is_blacklisted: true)
 * - Filters out unsupported protocols (is_wc_not_supported: true)
 * - Transforms response to match DiscoverProtocol interface
 * - Handles API errors gracefully with logging
 *
 * @throws {Error} When the API request fails or response is invalid
 *
 * @example
 * ```ts
 * const protocols = await fetchProtocols();
 * // Returns only non-blacklisted, supported protocols
 * ```
 */
export const fetchProtocols = async (): Promise<DiscoverProtocol[]> => {
  const { data } =
    await freighterBackendV2.get<ProtocolsResponse>("/protocols");

  if (!data.data || !data.data.protocols) {
    throw normalizeError(data);
  }

  // Filter out blacklisted/unsupported protocols and
  // transform the response to match our Protocol type
  return data.data.protocols
    .filter((protocol) => {
      if (
        protocol.is_blacklisted === true ||
        protocol.is_wc_not_supported === true
      ) {
        return false;
      }

      return true;
    })
    .map((protocol) => ({
      description: protocol.description,
      iconUrl: protocol.icon_url,
      name: protocol.name,
      websiteUrl: protocol.website_url,
      tags: protocol.tags,
    }));
};

/**
 * Parameters for fetching collectibles
 * @interface FetchCollectiblesParams
 * @property {string} owner - The public key of the account that owns the collectibles
 * @property {Object[]} contracts - Array of contract objects to query
 * @property {string} contracts[].id - The contract ID
 * @property {string[]} contracts[].token_ids - Array of token IDs to fetch
 */
export interface FetchCollectiblesParams {
  owner: string;
  contracts: {
    id: string;
    token_ids: string[];
  }[];
}

/**
 * Represents a single collectible item returned from the backend.
 * @typedef {Object} BackendCollectible
 * @property {string} owner - The public key of the owner of the collectible.
 * @property {string} token_id - The unique token ID of the collectible.
 * @property {string} token_uri - The URI pointing to the collectible's metadata JSON.
 */
export type BackendCollectible = {
  owner: string;
  token_id: string;
  token_uri: string; // token_uri is the URL of the token JSON metadata
};

/**
 * Represents a collection of collectibles returned from the backend.
 * @typedef {Object} BackendCollection
 * @property {Object} collection - The collection object.
 * @property {string} collection.address - The contract address of the collection.
 * @property {string} collection.name - The human-readable name of the collection.
 * @property {string} collection.symbol - The symbol/ticker of the collection.
 * @property {BackendCollectible[]} collection.collectibles - Array of collectibles in this collection.
 */
export type BackendCollection = {
  collection: {
    address: string;
    name: string;
    symbol: string;
    collectibles: BackendCollectible[];
  };
};

/**
 * Represents an error response for a collection or its tokens from the backend.
 * @typedef {Object} BackendCollectionError
 * @property {Object} error - The error object.
 * @property {string} error.collection_address - The contract address of the collection with the error.
 * @property {string} [error.error_message] - Optional error message for the collection.
 * @property {Array<{token_id: string, error_message: string}>} [error.tokens] - Optional array of token-level errors.
 */
export type BackendCollectionError = {
  error: {
    collection_address: string;
    error_message?: string;
    tokens?: {
      token_id: string;
      error_message: string;
    }[];
  };
};

/**
 * The response structure from the collectibles API endpoint.
 * @typedef {Object} CollectiblesResponse
 * @property {Object} data - The response data container.
 * @property {(BackendCollection | BackendCollectionError)[]} data.collections - Array of collection objects or error objects.
 */
export type CollectiblesResponse = {
  data: {
    collections: (BackendCollection | BackendCollectionError)[];
  };
};

/**
 * Fetches collectibles from the backend collectibles endpoint
 * @async
 * @function fetchCollectibles
 * @param {FetchCollectiblesParams} params - Parameters for collectibles fetching
 * @returns {Promise<(BackendCollection | BackendCollectionError)[]>} Promise resolving to array of collections or error objects
 *
 * @description
 * Retrieves collectibles from the backend:
 * - Fetches collectibles for the specified owner and contracts
 * - Uses POST request with owner and contracts array
 * - Each contract object contains an ID and array of token IDs
 * - Returns collections grouped by contract address
 * - Handles API errors gracefully with logging
 *
 * @throws {Error} When the API request fails or response is invalid
 *
 * @example
 * ```ts
 * const collections = await fetchCollectibles({
 *   owner: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
 *   contracts: [{
 *     id: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
 *     token_ids: ["abc", "def", "ghi"]
 *   }]
 * });
 * ```
 */
export const fetchCollectibles = async ({
  owner,
  contracts,
}: FetchCollectiblesParams): Promise<
  (BackendCollection | BackendCollectionError)[]
> => {
  try {
    const { data } = await freighterBackendV2.post<CollectiblesResponse>(
      "/collectibles",
      {
        owner,
        contracts,
      },
    );

    if (!data.data || !data.data.collections) {
      logger.error(
        "backendApi.fetchCollectibles",
        "Invalid response from server",
        data,
      );

      throw new Error("Invalid response from server");
    }

    return data.data.collections;
  } catch (error) {
    logger.error(
      "backendApi.fetchCollectibles",
      "Error fetching collectibles",
      error,
    );

    throw error;
  }
};
