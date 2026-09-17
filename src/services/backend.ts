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
import BigNumber from "bignumber.js";
import {
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NetworkDetails,
  NETWORKS,
} from "config/constants";
import { BackendEnvConfig } from "config/envConfig";
import { logger, normalizeError } from "config/logger";
import {
  TokenTypeWithCustomToken,
  BalanceMap,
  FormattedSearchTokenRecord,
  GetTokenDetailsParams,
  DiscoverProtocol,
  PriceHistoryRange,
  TokenDetailsResponse,
  TokenIdentifier,
  TokenPriceHistory,
  TokenPriceHistoryResponse,
  TokenPricesMap,
  TokenStats,
  TokenStatsResponse,
} from "config/types";
import { addBlockaidScanResults } from "helpers/addBlockaidScanResults";
import { isNativeContract } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";
import { bigize } from "helpers/bigize";
import { injectLocalTokenBalances } from "helpers/injectLocalTokenBalances";
import {
  mapAccountBalancesV2,
  V2AccountBalances,
} from "helpers/mapAccountBalancesV2";
import { getNativeContractDetails, isContractId } from "helpers/soroban";
import { classifyToken, isNativeKind } from "helpers/tokenClassification";
import {
  createApiService,
  isRequestCanceled,
  logApiError,
} from "services/apiFactory";
import { attachAuthInterceptors } from "services/auth/attachAuth";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

// Create dedicated API services for backend operations
export const freighterBackendV1 = createApiService({
  baseURL: BackendEnvConfig.FREIGHTER_BACKEND_V1_URL,
});
// Attach per-request JWT auth to the v2 backend instance via the
// configureInstance hook so the auth interceptors are registered BEFORE
// apiFactory's error-normalizing response interceptor.  Axios runs response
// interceptors in registration order; if attachAuthInterceptors were called
// after createApiService returns, the 401-retry handler would run AFTER the
// normalizer and never see error.response (already converted to ApiError).
export const freighterBackendV2 = createApiService({
  baseURL: BackendEnvConfig.FREIGHTER_BACKEND_V2_URL,
  configureInstance: attachAuthInterceptors,
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

/**
 * Checks if a contract's transfer function supports muxed addresses (CAP-0067)
 * by examining the contract specification.
 *
 * A contract supports muxed addresses if the transfer function has a `to_muxed` parameter.
 * This is the CAP-0067 pattern where the transfer signature is:
 * transfer(from: Address, to_muxed: MuxedAddress, amount: i128)
 *
 * @param contractId - The contract ID to check
 * @param networkDetails - Network details
 * @returns Promise resolving to true if contract supports muxed addresses, false otherwise
 */
export const checkContractSupportsMuxed = async ({
  contractId,
  networkDetails,
}: {
  contractId: string;
  networkDetails: NetworkDetails;
}): Promise<boolean> => {
  try {
    const spec = await getContractSpecs({ contractId, networkDetails });

    // Check if transfer function exists
    const definitions = spec.definitions as
      | {
          transfer?: {
            properties?: {
              args?: {
                properties?: Record<string, unknown>;
                required?: string[];
              };
            };
          };
        }
      | undefined;
    const transferDef = definitions?.transfer;
    if (!transferDef) {
      return false;
    }

    // Get args properties and required array
    const argsProperties = transferDef.properties?.args?.properties;
    const required = transferDef.properties?.args?.required;

    // Check if 'to_muxed' parameter exists in properties (CAP-0067 pattern)
    // Use 'in' operator to check if key exists, regardless of value
    if (argsProperties && "to_muxed" in argsProperties) {
      return true;
    }

    // Also check if to_muxed is in the required array (even if property doesn't exist)
    if (Array.isArray(required) && required.includes("to_muxed")) {
      return true;
    }

    return false;
  } catch (error) {
    // If we can't fetch the spec, assume no muxed support for safety
    return false;
  }
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
  /**
   * Contract IDs present in `balances` only because they are in the user's
   * locally saved custom-token list. The only contract tokens that may be
   * removed from the balances view — see `MappedAccountBalances`.
   */
  localOnlyTokenIds?: string[];
};

/**
 * Parameters for fetching account balances
 * @typedef {Object} FetchBalancesParams
 * @property {string} publicKey - The public key of the account
 * @property {NETWORKS} network - The network to query (mainnet/testnet)
 * @property {string[]} [contractIds] - Optional contract IDs to include in balance calculation
 * @property {boolean} useV2 - Whether to hit the v2 balances endpoint (remote-config gated)
 * @property {boolean} [shouldSkipScan] - Skip Blockaid asset scanning (faster; for list views that don't render scan results)
 */
type FetchBalancesParams = {
  publicKey: string;
  network: NETWORKS;
  contractIds?: string[];
  useV2: boolean;
  shouldSkipScan?: boolean;
};

/**
 * Fetches account balances from the freighter-backend-v2
 * `POST /accounts/balances` endpoint and normalizes the response to the same
 * shape `fetchBalances` returns on the v1 path.
 *
 * Multi-address fan-out endpoint; the app fetches one account at a time.
 * Addresses travel in the POST body, so the URL carries no G-address. The v2
 * response covers every token the account *holds* — trustlines, SACs, SEP-41
 * contract balances, and pool shares — so unlike v1 there is no `contract_ids`
 * param.
 *
 * "Holds" is the catch: the indexer only knows about tokens an account has a
 * balance for, so a zero-balance SEP-41 token the user added by hand never
 * comes back and would silently disappear. `contractIds` (the locally saved
 * custom-token list) is therefore merged back in client-side by
 * `injectLocalTokenBalances`, which is what v1 did server-side with its
 * `contract_ids` hints. Skipped for an unfunded account: the not-funded UI
 * renders in place of balances, so resolving tokens would only burn requests.
 *
 * The backend contract guarantees one result per requested address — an
 * unfunded account comes back as a matching entry with `is_funded: false`,
 * never as an omission. A 200 missing the requested account is therefore a
 * malformed/partial response and is rejected rather than rendered as
 * unfunded, which would wrongly replace a funded user's balances with the
 * unfunded UI.
 *
 * The v2 response has no Blockaid data yet — `addBlockaidScanResults`
 * replicates the v1 backend's scan-and-merge client-side so both paths return
 * the same payload. It runs after the local merge so locally added tokens get
 * Blockaid verdicts too, as they did on v1. `shouldSkipScan` bypasses it for
 * callers that never render scan results, mirroring the `should_skip_scan`
 * param the v1 path forwards to the backend.
 */
export const fetchBalancesV2 = async ({
  publicKey,
  network,
  contractIds,
  shouldSkipScan,
}: {
  publicKey: string;
  network: NETWORKS;
  contractIds?: string[];
  shouldSkipScan?: boolean;
}): Promise<FetchBalancesResponse> => {
  const { data } = await freighterBackendV2.post<{
    data: V2AccountBalances[];
  }>("/accounts/balances", { addresses: [publicKey] }, { params: { network } });

  const account = (data?.data || []).find(
    (accountBalances) => accountBalances.address === publicKey,
  );

  if (!account) {
    // The public key stays out of this message deliberately: it becomes the
    // Sentry issue title verbatim, which bypasses sanitizeLogData (that walk
    // is key-based and returns an Error's `message` untouched) and would ship
    // the key regardless of the analytics opt-in. Callers pass it as a
    // structured extra instead. Keeping the message constant also keeps every
    // occurrence grouped under one Sentry issue rather than one per account.
    throw new Error("v2 balances response is missing the requested account");
  }

  const mappedBalances = mapAccountBalancesV2(account);
  const mergedBalances = account.is_funded
    ? await injectLocalTokenBalances({
        accountBalances: mappedBalances,
        backendTokenIds: new Set(
          (account.balances || []).map((balance) => balance.token_id),
        ),
        localTokenIds: contractIds,
        networkPassphrase:
          mapNetworkToNetworkDetails(network).networkPassphrase,
        // getTokenDetails is defined further down this module. Safe: this
        // closure only runs once a caller invokes the fetcher, long after the
        // module has finished evaluating.
        fetchTokenDetails: (contractId) =>
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          getTokenDetails({
            contractId,
            publicKey,
            network,
            shouldFetchBalance: true,
          }),
      })
    : mappedBalances;

  if (shouldSkipScan) {
    return mergedBalances;
  }

  return addBlockaidScanResults(mergedBalances, network);
};

/**
 * Fetches account balances from the backend API
 * @async
 * @function fetchBalances
 * @param {FetchBalancesParams} params - Parameters for balance fetching
 * @param {string} params.publicKey - The public key of the account
 * @param {NETWORKS} params.network - The network to query (mainnet/testnet)
 * @param {string[]} [params.contractIds] - Optional contract IDs to include (v1 path only)
 * @param {boolean} params.useV2 - Whether to hit the v2 endpoint (remote-config gated)
 * @returns {Promise<FetchBalancesResponse>} Promise resolving to account balance data
 *
 * @description
 * When `useV2` is true and the network is pubnet/testnet, delegates to
 * `fetchBalancesV2` (same response shape). Otherwise fetches account balances
 * from the v1 backend and transforms the response:
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
 *   contractIds: ["contract123"],
 *   useV2: true,
 * });
 * ```
 */
export const fetchBalances = async ({
  publicKey,
  network,
  contractIds,
  useV2,
  shouldSkipScan,
}: FetchBalancesParams): Promise<FetchBalancesResponse> => {
  // The v2 balances endpoint only supports pubnet and testnet; Futurenet
  // stays on v1 regardless of the flag. v2 sends no contract_ids — indexed
  // contract-token balances come back on their own — but it still needs the
  // local list to merge back the zero-balance tokens the indexer never returns.
  const isV2SupportedNetwork =
    network === NETWORKS.PUBLIC || network === NETWORKS.TESTNET;
  if (useV2 && isV2SupportedNetwork) {
    return fetchBalancesV2({ publicKey, network, contractIds, shouldSkipScan });
  }

  const params = new URLSearchParams({
    network,
  });

  if (contractIds?.length) {
    contractIds.forEach((id) => {
      params.append("contract_ids", id);
    });
  }

  if (shouldSkipScan) {
    params.append("should_skip_scan", "true");
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
    // v1 returns a contract-token balance only for an ID it was handed, so
    // every locally saved contract is removable from the balances view.
    localOnlyTokenIds: contractIds ?? [],
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
  /** Active network — the v2 endpoint is network-scoped */
  network: NETWORKS;
  /** Whether to hit the network-scoped v2 endpoint (remote-config gated) */
  useV2: boolean;
}

/**
 * Networks we fetch fiat prices for, mapped to the `network` query value the v2
 * endpoint expects. Only mainnet has a real price source — testnet assets have
 * no market and v2 returns $0, so (like the browser extension) we gate testnet
 * out and show no fiat there. Networks absent from this map (testnet, futurenet)
 * are skipped on both v1 and v2, so a rollback can't reintroduce testnet fiat.
 */
const PRICE_NETWORK_PARAMS: Partial<Record<NETWORKS, string>> = {
  [NETWORKS.PUBLIC]: NETWORKS.PUBLIC,
};

/**
 * Wire identifier the v2 /token-prices endpoint expects for the native asset.
 * The app uses NATIVE_TOKEN_CODE ("XLM") everywhere, but v2 keys the native
 * asset as "native" (matching the browser extension). We translate only at the
 * v2 request/response boundary so the rest of the app keeps using "XLM".
 */
const V2_NATIVE_PRICE_ID = "native";

/**
 * The wire identity for the price endpoints. They key the native asset as
 * "native", and nativeness is a RESOLVED type, not a shape: XLM's own Stellar
 * Asset Contract reaches this layer as `XLM:<contract id>` (contract balances
 * canonicalize `symbol:contractId`), which `isNativeAssetId` does not match.
 * Left unresolved, the About card reads "Native" while the request asks for a
 * Soroban contract — a different asset to the backend. `classifyToken` is the
 * one place that resolves this, so it decides here too.
 */
const toWireToken = (tokenId: TokenIdentifier, network: NETWORKS): string =>
  isNativeKind(classifyToken(tokenId, network).kind)
    ? V2_NATIVE_PRICE_ID
    : tokenId;

/**
 * Fetches the current USD prices and 24h percentage changes for the given tokens.
 *
 * When `useV2` is true, hits the network-scoped v2 endpoint, passing the active
 * network as a `network` query param; networks the endpoint doesn't serve (e.g.
 * Futurenet) are skipped and return null prices. When false, falls back to the
 * v1 endpoint. LP shares are always filtered out before the request; custom
 * (SEP-41 contract) tokens are filtered only on the legacy v1 path, since the
 * v2 backend prices them. Any requested token without a returned price is
 * filled with null.
 *
 * @param params Tokens to price, the active network, and the v2 flag
 * @returns Promise resolving to a map of token identifiers to their price information
 *
 * @example
 * // Fetch prices for XLM and USDC on mainnet via v2
 * const prices = await fetchTokenPrices({
 *   tokens: [
 *     "XLM",
 *     "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 *   ],
 *   network: NETWORKS.PUBLIC,
 *   useV2: true,
 * });
 *
 * // Access individual token prices
 * const xlmPrice = prices["XLM"];
 * console.log(`XLM price: $${xlmPrice.currentPrice} (${xlmPrice.percentagePriceChange24h}% 24h change)`);
 */
export const fetchTokenPrices = async ({
  tokens,
  network,
  useV2,
}: FetchTokenPricesParams): Promise<TokenPricesMap> => {
  // The old single exclusion predicate is SPLIT, not moved (token price
  // graphs design §4.1, Phase 1 item 5):
  // - LP shares filter out unconditionally on BOTH paths — they are never
  //   priceable, and an LP id reaching the batch endpoint fails parsing.
  // - Custom (SEP-41 contract) tokens filter out only on the legacy v1
  //   rollback path, whose Node backend errors on them. The Go v2 backend
  //   prices contract tokens, so v2 requests include them — without this, a
  //   priced SEP-41 token would show a live chart under a "--" price.
  const filteredTokens = tokens.filter((tokenId) => {
    // `getTokenType` has no bare-contract-id case: anything without a colon
    // that is not native falls through to its LP catch-all. A bare `C…` id —
    // the form `classifyToken` and `toWireToken` both accept, including the
    // native SAC — would therefore be dropped here as unpriceable and come
    // back "--", even though v2 prices contract tokens. Resolve the shape
    // before asking for a type.
    const isBareContractId = isContractId(tokenId);
    const token = getTokenType(tokenId);

    if (
      !isBareContractId &&
      token === TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES
    ) {
      return false;
    }

    // A bare contract id is a contract token, so the legacy path drops it for
    // the same reason it drops `SYMBOL:CONTRACTID`.
    return (
      useV2 ||
      (!isBareContractId && token !== TokenTypeWithCustomToken.CUSTOM_TOKEN)
    );
  });

  // Skip the request entirely — returning empty prices that the loop below
  // fills with nulls (→ "--" in the UI) — when there's nothing to ask for, or
  // when the active network isn't priceable (testnet/futurenet). Fiat is
  // mainnet-only; gating here applies to both v1 and v2 so a rollback can't
  // reintroduce testnet fiat, and avoids guaranteed-failing/zero-value calls.
  const priceNetwork = PRICE_NETWORK_PARAMS[network];
  const shouldSkipRequest = filteredTokens.length === 0 || !priceNetwork;

  let pricesMap: TokenPricesMap = {};

  if (!shouldSkipRequest) {
    try {
      let data: TokenPricesResponse;
      if (useV2) {
        // The v2 endpoint is network-scoped via a `network` query param and keys
        // the native asset as "native", so translate "XLM" -> "native" on the
        // way out (v1, below, is neither network-scoped nor native-translated).
        // `toWireToken`, not `isNativeAssetId`: XLM's own SAC arrives as
        // `XLM:<contract id>` and would otherwise be priced as a Soroban
        // contract — a different asset to the backend — leaving the balance
        // on "--" beside a chart this PR now correctly resolves as native.
        const v2Tokens = filteredTokens.map((tokenId) =>
          toWireToken(tokenId, network),
        );
        ({ data } = await freighterBackendV2.post<TokenPricesResponse>(
          "/token-prices",
          { tokens: v2Tokens },
          { params: { network: priceNetwork } },
        ));
      } else {
        ({ data } = await freighterBackendV1.post<TokenPricesResponse>(
          "/token-prices",
          { tokens: filteredTokens },
        ));
      }

      // Defensive: if the endpoint returns an unexpected shape (e.g. v2
      // diverges from `{ data: TokenPricesMap }`), fall back to an empty map so
      // the null-fill loop below still produces a valid TokenPricesMap instead
      // of throwing and silently wiping out all prices.
      if (!data?.data) {
        logger.warn(
          "backendApi.fetchTokenPrices",
          "Unexpected token-prices response shape",
          { useV2, topLevelKeys: data ? Object.keys(data) : [] },
        );
      }
      pricesMap = data?.data ?? {};

      // Translate the native price back to EVERY identifier that resolved to
      // it — "XLM", "native", and the SAC forms alike. The null-fill loop
      // below keys off the original (un-translated) `tokens`, so an id left
      // unaliased here shows "--" even though we hold its price.
      if (useV2 && pricesMap[V2_NATIVE_PRICE_ID]) {
        const nativePrice = pricesMap[V2_NATIVE_PRICE_ID];
        const nativeOriginals = filteredTokens.filter(
          (tokenId) => toWireToken(tokenId, network) === V2_NATIVE_PRICE_ID,
        );

        nativeOriginals.forEach((tokenId) => {
          pricesMap[tokenId] = nativePrice;
        });
        // The app's own convention, kept for callers that key off it.
        pricesMap[NATIVE_TOKEN_CODE] = nativePrice;
        // Only drop the wire key when it is not itself one of the ids asked
        // for ("native" is a legitimate app-side identifier).
        if (!nativeOriginals.includes(V2_NATIVE_PRICE_ID)) {
          delete pricesMap[V2_NATIVE_PRICE_ID];
        }
      }
    } catch (error) {
      // Without this, the store callers swallow price-fetch failures (keeping
      // stale prices / a local error string) with no Sentry signal — so a
      // broadly-failing endpoint (e.g. a bad v2 rollout) would be invisible.
      // Connectivity failures (offline/DNS/TLS) demote to a warn breadcrumb;
      // backend 4xx/5xx and timeouts surface as logger.error. Rethrow so the
      // callers still manage UI state.
      logApiError(
        "backendApi.fetchTokenPrices",
        "Network unreachable while fetching token prices",
        "Error fetching token prices",
        error,
      );
      throw error;
    }
  }

  /*
  // ========================================================
  // Uncomment this to simulate a token-prices response — useful for exercising
  // the price UI locally without depending on live backend data.

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
 * Request parameters for fetching a token's price-history series
 */
export interface FetchTokenPriceHistoryParams {
  /** App-side token identifier ("XLM", "native", CODE:ISSUER, SYMBOL:CONTRACTID, or a bare contract ID) */
  tokenId: TokenIdentifier;
  /** Active network — the endpoint is network-scoped (clients call it on PUBLIC only) */
  network: NETWORKS;
  /** Timeframe to fetch */
  range: PriceHistoryRange;
}

/**
 * The endpoint keys the native asset as "native", so anything resolving to it
 * is translated here; other identifiers pass through and are echoed back.
 *
 * No data is a 200 with `points: []` and `change: null`, never an error; only
 * transport failures reject, and callers own the reporting.
 *
 * @returns the price-history payload (string prices; parse with BigNumber)
 */
/**
 * A decimal string the chart can do arithmetic on — not merely non-empty.
 * `Number("  ")` is 0, so a whitespace-only price would otherwise pass here
 * and surface downstream as NaN prices and NaN chart coordinates.
 */
const isNumericString = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim() !== "" &&
  new BigNumber(value).isFinite();

/**
 * A quantity that cannot be negative — a price, a supply, a holder count.
 * `formatPriceHistoryLabel` takes `abs()` before formatting, so a negative
 * close would be plotted against a normalized scale and then LABELLED as a
 * positive dollar amount: a malformed payload rendered as plausible market
 * data. A range `change` is the exception and stays on `isNumericString`,
 * since a fall is legitimately negative.
 */
const isNonNegativeNumericString = (value: unknown): value is string =>
  isNumericString(value) && !new BigNumber(value).isNegative();

/**
 * Unix seconds `Date` can represent. Finite is not enough: `Date` covers
 * ±8.64e15 ms and `Intl.DateTimeFormat#format` throws a RangeError beyond
 * that — during render, where it would take down the screen rather than
 * degrading to the section's ordinary error state.
 */
const isFormattableUnixSeconds = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(new Date(value * 1000).getTime());

/**
 * The response must be for the request that asked for it. The backend echoes
 * the token key and range verbatim; a well-formed body for another asset or
 * range would otherwise be cached under this key and drawn under this tab.
 */
const assertEchoes = <T extends object>(
  label: string,
  expected: Partial<Record<keyof T, string>>,
  data: T,
) => {
  (Object.entries(expected) as [keyof T, string][]).forEach(([field, want]) => {
    const got: unknown = data?.[field];
    if (got !== want) {
      throw new Error(
        `${label}: response ${String(field)} ${String(got)} does not match requested ${want}`,
      );
    }
  });
};

/**
 * Rejects a series the chart cannot safely draw, at the API boundary, so a
 * malformed payload becomes an ordinary fetch failure (reported, rendered as
 * the error state) instead of NaN geometry or a RangeError thrown in render.
 * Mirrors the extension's `assertDrawableSeries` field for field.
 */
const assertDrawableSeries = (data: TokenPriceHistory) => {
  if (!Array.isArray(data?.points)) {
    throw new Error("token price history: points is not an array");
  }
  // Added to the last timestamp to label the range end, and the bucket width
  // every point is plotted at: zero or negative would place a bucket's close
  // at or before its own start.
  if (
    !(Number.isFinite(data?.resolutionSeconds) && data.resolutionSeconds > 0)
  ) {
    throw new Error(
      `token price history: non-positive or non-finite resolutionSeconds (${String(
        data?.resolutionSeconds,
      )})`,
    );
  }
  // Every label downstream prints these values with a "$". A payload in
  // another currency would be cached and displayed as dollars, so the wire
  // contract's USD is enforced here rather than assumed.
  if (data?.currency !== "USD") {
    throw new Error(
      `token price history: unexpected currency (${String(data?.currency)})`,
    );
  }
  // `null` means "verdict unavailable" and shows a warning; a missing or
  // stringly value would read as `false` and silence it.
  if (data?.lowVolume !== null && typeof data?.lowVolume !== "boolean") {
    throw new Error(
      `token price history: malformed lowVolume (${String(data?.lowVolume)})`,
    );
  }
  const bad = data.points.findIndex(
    (point) =>
      !isFormattableUnixSeconds(point?.t) ||
      !isNonNegativeNumericString(point?.p),
  );
  if (bad !== -1) {
    throw new Error(
      `token price history: malformed point at index ${bad} (t=${String(
        data.points[bad]?.t,
      )}, p=${String(data.points[bad]?.p)})`,
    );
  }
  // `computeChartGeometry` takes the FIRST bucket end as t0 and normalizes
  // every x against it, clamping only the last point. A series that goes
  // backwards — [200, 100, 300] — therefore yields a negative x and a line
  // that doubles back, and would be cached and drawn rather than failing.
  // Equal timestamps collapse to one x, which the geometry already handles,
  // so only a strict decrease is rejected.
  const outOfOrder = data.points.findIndex(
    (point, index) => index > 0 && point.t < data.points[index - 1].t,
  );
  if (outOfOrder !== -1) {
    throw new Error(
      `token price history: points out of chronological order at index ${outOfOrder} (${String(
        data.points[outOfOrder - 1]?.t,
      )} then ${String(data.points[outOfOrder]?.t)})`,
    );
  }
  const last = data.points[data.points.length - 1];
  if (last && !isFormattableUnixSeconds(last.t + data.resolutionSeconds)) {
    throw new Error(
      `token price history: range end outside Date range (t=${String(
        last.t,
      )}, resolutionSeconds=${String(data.resolutionSeconds)})`,
    );
  }
  // `change` is NULLABLE, not optional: the §6.1 contract has it present on
  // every payload, `null` when the §4.2 coverage guard rejects the window.
  // `!= null` would wave through a missing field as though the backend had
  // deliberately declined to compute a change, and the empty header that
  // produces is indistinguishable from the legitimate null — cached, and
  // silently wrong. Same rule the `lowVolume` verdict above is held to.
  if (data.change === undefined) {
    throw new Error("token price history: missing change");
  }

  if (data.change !== null) {
    if (
      !isNumericString(data.change.absolute) ||
      !isNumericString(data.change.percent)
    ) {
      throw new Error(
        `token price history: malformed change (absolute=${String(
          data.change.absolute,
        )}, percent=${String(data.change.percent)})`,
      );
    }
    // The header prints ONE sign, taken from the percent, in front of both
    // halves — the dollar term is rendered by magnitude. So a payload whose
    // two halves disagree would not be rejected, it would be silently
    // restated: `absolute: "-1", percent: "2"` reads as "+$1.00 (2.00%)", a
    // loss shown as a gain. Either may be zero while the other is not, which
    // is ordinary rounding on a small move.
    const absoluteChange = new BigNumber(data.change.absolute);
    const percentChange = new BigNumber(data.change.percent);
    if (
      !absoluteChange.isZero() &&
      !percentChange.isZero() &&
      absoluteChange.isNegative() !== percentChange.isNegative()
    ) {
      throw new Error(
        `token price history: change halves disagree on sign (absolute=${data.change.absolute}, percent=${data.change.percent})`,
      );
    }
  }
};

/**
 * Absent fields are the contract; present ones must be numeric, or the card
 * renders a literal "NaN" row (BigNumber.DEBUG is unset, so nothing throws).
 */
const assertTokenStats = (data: TokenStats) => {
  if (
    data?.supplyOnStellar !== undefined &&
    !isNonNegativeNumericString(data.supplyOnStellar)
  ) {
    throw new Error(
      `token stats: malformed supplyOnStellar (${String(data.supplyOnStellar)})`,
    );
  }
  if (
    data?.holders !== undefined &&
    !(Number.isSafeInteger(data.holders) && data.holders >= 0)
  ) {
    // A holder count is a whole number of accounts. `formatStatValue` rounds
    // down, so a fractional 1.9 would render as a plausible "1".
    throw new Error(`token stats: malformed holders (${String(data.holders)})`);
  }
};

export const fetchTokenPriceHistory = async ({
  tokenId,
  network,
  range,
}: FetchTokenPriceHistoryParams): Promise<TokenPriceHistory> => {
  const wireToken = toWireToken(tokenId, network);

  const { data } = await freighterBackendV2.get<TokenPriceHistoryResponse>(
    "/token-price-history",
    { params: { token: wireToken, network, range } },
  );

  if (!data?.data) {
    throw new Error("Unexpected token-price-history response shape");
  }

  assertEchoes("token price history", { token: wireToken, range }, data.data);
  assertDrawableSeries(data.data);

  return data.data;
};

/**
 * Request parameters for fetching a token's stats
 */
export interface FetchTokenStatsParams {
  /** App-side token identifier (same forms as {@link FetchTokenPriceHistoryParams.tokenId}) */
  tokenId: TokenIdentifier;
  /** Active network — the endpoint is network-scoped (clients call it on PUBLIC only) */
  network: NETWORKS;
}

/**
 * Fetches the Token Stats payload (supply on Stellar / holders) from the v2
 * backend. Fields the backend cannot source are absent from the payload
 * entirely — render only the rows present.
 *
 * @param params Token to fetch and the active network
 * @returns Promise resolving to the stats payload
 */
export const fetchTokenStats = async ({
  tokenId,
  network,
}: FetchTokenStatsParams): Promise<TokenStats> => {
  const wireToken = toWireToken(tokenId, network);

  const { data } = await freighterBackendV2.get<TokenStatsResponse>(
    "/token-stats",
    { params: { token: wireToken, network } },
  );

  if (!data?.data) {
    throw new Error("Unexpected token-stats response shape");
  }

  assertEchoes("token stats", { token: wireToken }, data.data);
  assertTokenStats(data.data);

  return data.data;
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
  shouldFetchBalance,
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
          // Off by default: the balance costs the backend an extra contract
          // call, and most callers only want the token's metadata.
          ...(shouldFetchBalance ? { should_fetch_balance: true } : {}),
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
      // Connectivity failures (offline, DNS, TLS, captive portal) -
      // demote to warn so they remain as breadcrumb context without
      // creating top-level Sentry issues. Backend bugs (4xx/5xx
      // responses, malformed payloads) and axios client-side timeouts
      // (carved out of isApiNetworkError so latency regressions stay
      // visible) still surface as logger.error.
      logApiError(
        "backendApi.getTokenDetails",
        "Network unreachable while fetching token details",
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
    logApiError(
      "backendApi.isSacContractExecutable",
      "Network unreachable while checking SAC contract",
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
    logApiError(
      "backendApi.getAccountHistory",
      "Network unreachable while fetching account history",
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
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);

  if (isNativeContract(contractId, networkPassphrase)) {
    const nativeContractDetails = getNativeContractDetails(network);

    return {
      tokenCode: nativeContractDetails.code,
      domain: nativeContractDetails.domain,
      hasTrustline: true,
      // The native asset has no issuer; matches the stellar.expert path's
      // native record (`issuer: issuer ?? ""`).
      issuer: "",
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
    // No domain is available for a contract token; the UI falls back to "-".
    domain: "",
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
 * @property {string} params.amount - Amount to transfer in base units
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
 * @property {SorobanSimulationResponse} simulationResponse - Soroban simulation response with fee data
 * @property {string} preparedTransaction - XDR-encoded prepared transaction
 */
export interface SimulateTransactionResponse {
  simulationResponse: SorobanSimulationResponse;
  preparedTransaction: string;
}

export interface SorobanSimulationResponse {
  minResourceFee?: string;
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
    preparedTx: TransactionBuilder.fromXdr(
      data.preparedTransaction,
      params.network_passphrase,
    ),
  };
};

/**
 * Parameters for operation simulation
 * @interface SimulateTransactionParams
 * @property {string} xdr - prebuilt xdr to simulate on the network
 * @property {string} network_url - Network URL for simulation
 * @property {string} network_passphrase - Network passphrase
 */
export interface SimulateTransactionParams {
  xdr: string;
  network_url: string;
  network_passphrase: string;
}

/**
 * Simulates an operation
 * @async
 * @function simulateTransaction
 * @param {SimulateTransactionParams} params - Simulation parameters
 * @returns {Promise<Object>} Promise resolving to simulation result with prepared transaction
 *
 * @description
 * Simulates an operation:
 * - Returns simulation response and prepared transaction
 * - Converts XDR to TransactionBuilder for easy manipulation
 *
 * @throws {Error} When the simulation fails
 *
 * @example
 * ```ts
 * const result = await simulateTransaction({
 *   xdr: "...",
 *   network_url: "https://horizon.stellar.org",
 *   network_passphrase: "Public Global Stellar Network"
 * });
 * ```
 */
export const simulateTransaction = async (
  params: SimulateTransactionParams,
) => {
  const { data } = await freighterBackendV1.post<SimulateTransactionResponse>(
    "/simulate-tx",
    params,
  );

  return data;
};

/**
 * Body for submitting a transaction
 * @interface SubmitTransactionBody
 * @property {string} signed_xdr - xdr to submit
 * @property {string} network_url - Network URL for submission
 * @property {string} network_passphrase - Network passphrase
 */
export interface SubmitTransactionBody {
  signed_xdr: string;
  network_url: string;
  network_passphrase: string;
}

/**
 * submits an transaction
 * @async
 * @function submitTransaction
 * @param {SubmitTransactionBody} params - Submission details
 * @returns {Promise<Object>} Promise resolving to a HorizonApi.SubmitTransactionResponse
 *
 * @description
 * Submits a transaction to the network:
 *
 * @throws {Error} When the submission fails
 *
 * @example
 * ```ts
 * const _params = [
 *  new Sdk.Address(params.publicKey).toScVal(),
 *  new Sdk.Address(params.destination).toScVal(),
 *  new Sdk.XdrLargeInt("i128", params.amount).toI128(),
 * ];
 * const result = await submitTransaction({
 *   body: {
 *    signed_xdr: "...",
 *    network_url: "https://horizon.stellar.org",
 *    network_passphrase: "Public Global Stellar Network"
 *  }
 * });
 * ```
 */
export const submitTransaction = async (body: SubmitTransactionBody) => {
  const { data } =
    await freighterBackendV1.post<Horizon.HorizonApi.SubmitTransactionResponse>(
      "/submit-tx",
      body,
    );

  return data;
};

/**
 * Response from the protocols API
 * @interface ProtocolsResponse
 * @property {Object} data - Response data container
 * @property {Object[]} data.protocols - Array of protocol objects
 * @property {string} data.protocols[].description - Protocol description. Rendered via
 * LinkedText (components/LinkedText): supports markdown-style `[text](https://...)` links
 * and bare `https://` URLs, which render as tappable links. No other markdown/HTML is parsed.
 * @property {string} data.protocols[].icon_url - Protocol icon URL
 * @property {string} data.protocols[].name - Protocol name
 * @property {string} data.protocols[].website_url - Protocol website URL
 * @property {string[]} data.protocols[].tags - Protocol tags/categories
 * @property {string} [data.protocols[].background_url] - Protocol background image URL for cards/carousels
 * @property {boolean} [data.protocols[].is_blacklisted] - Whether protocol is blacklisted
 * @property {boolean} [data.protocols[].is_wc_not_supported] - Whether protocol supports WalletConnect
 * @property {boolean} [data.protocols[].is_trending] - Whether protocol is featured in the trending carousel
 */
interface ProtocolsResponse {
  data: {
    protocols: {
      description: string;
      icon_url: string;
      name: string;
      website_url: string;
      tags: string[];
      background_url?: string;
      is_blacklisted?: boolean;
      is_wc_not_supported?: boolean;
      is_trending?: boolean;
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
      backgroundUrl: protocol.background_url,
      isTrending: protocol.is_trending ?? false,
    }));
};

/**
 * Parameters for fetching collectibles
 * @interface FetchCollectiblesParams
 * @property {string} owner - The public key of the account that owns the collectibles
 * @property {Object[]} contracts - Array of contract objects to query
 * @property {string} contracts[].id - The contract ID
 * @property {string[]} contracts[].token_ids - Array of token IDs to fetch
 * @property {string} network - The network to query (PUBLIC or TESTNET)
 */
export interface FetchCollectiblesParams {
  owner: string;
  contracts: {
    id: string;
    token_ids: string[];
  }[];
  network: string;
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
 *   }],
 *   network: NETWORKS.PUBLIC
 * });
 * ```
 */
export const fetchCollectibles = async ({
  owner,
  contracts,
  network,
}: FetchCollectiblesParams): Promise<
  (BackendCollection | BackendCollectionError)[]
> => {
  try {
    const { data } = await freighterBackendV2.post<CollectiblesResponse>(
      "/collectibles",
      { owner, contracts },
      { params: { network } },
    );

    if (!data.data || !data.data.collections) {
      // Demote this inner log to a breadcrumb so it doesn't fire its
      // own captureException - the catch below already logs the
      // thrown Error once. Without this, one bad payload produced
      // two Sentry events. Capture only the payload shape (top-level
      // and inner keys) so we can recognize a backend contract change
      // without uploading user-identifying values like account IDs.
      logger.warn(
        "backendApi.fetchCollectibles",
        "Invalid response shape - missing data.collections",
        {
          topLevelKeys: Object.keys(data ?? {}),
          innerKeys: Object.keys((data as { data?: unknown })?.data ?? {}),
        },
      );

      throw new Error("Invalid response from server");
    }

    return data.data.collections;
  } catch (error) {
    // Connectivity failures (offline, DNS, TLS, captive portal) are not
    // backend bugs — demote to warn so they remain as breadcrumb context
    // without creating top-level Sentry issues. Backend bugs (4xx/5xx
    // responses, malformed payloads, the "Invalid response from server"
    // throw above) and axios client-side timeouts (carved out of
    // isApiNetworkError so latency regressions stay visible) still
    // surface as logger.error.
    logApiError(
      "backendApi.fetchCollectibles",
      "Network unreachable while fetching collectibles",
      "Error fetching collectibles",
      error,
    );

    throw error;
  }
};
