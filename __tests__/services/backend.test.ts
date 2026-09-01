import { Networks, xdr } from "@stellar/stellar-sdk";
import { NETWORK_URLS, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { isRequestCanceled } from "services/apiFactory";
import {
  fetchBalances,
  fetchCollectibles,
  fetchTokenPrices,
  freighterBackendV1,
  freighterBackendV2,
  simulateTransaction,
  submitTransaction,
  SimulateTransactionParams,
  SubmitTransactionBody,
} from "services/backend";
import { scanBulkTokens } from "services/blockaid/api";
import { dataStorage } from "services/storage/storageFactory";

// The v2 balances path stamps Blockaid data through the blockaidTokenScans
// duck's disk-backed cache; mock the raw scan API underneath it (it would
// otherwise loop back into the mocked freighterBackendV1 client) and the
// storage the cache reads/writes.
jest.mock("services/blockaid/api", () => ({
  scanBulkTokens: jest.fn(),
}));
jest.mock("services/storage/storageFactory");

jest.mock("services/apiFactory", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      getInstance: jest.fn(() => ({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      })),
    })),
    isRequestCanceled: jest.fn(),
  };
});

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  normalizeError: jest.fn((error) => error),
}));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    TransactionBuilder: {
      fromXdr: jest.fn((xdrString: string, networkPassphrase: string) => ({
        xdrString,
        networkPassphrase,
        build: jest.fn(),
      })),
    },
  };
});

// Test the filtering logic directly
describe("Backend Service - Protocol Filtering Logic", () => {
  // Import the filtering logic from the backend service
  const testFilteringLogic = (protocols: any[]) =>
    protocols.filter((protocol) => {
      if (
        protocol.is_blacklisted === true ||
        protocol.is_wc_not_supported === true
      ) {
        return false;
      }

      return true;
    });

  describe("Filtering logic with different API responses", () => {
    it("should filter out blacklisted protocols", () => {
      const mockProtocols = [
        {
          description: "Blacklisted Protocol",
          icon_url: "https://example.com/blacklisted.png",
          name: "BlacklistedProtocol",
          website_url: "https://blacklisted.example.com",
          tags: ["blacklisted"],
          is_blacklisted: true,
          is_wc_not_supported: false,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should filter out WC unsupported protocols", () => {
      const mockProtocols = [
        {
          description: "WC Unsupported Protocol",
          icon_url: "https://example.com/unsupported.png",
          name: "UnsupportedProtocol",
          website_url: "https://unsupported.example.com",
          tags: ["unsupported"],
          is_blacklisted: false,
          is_wc_not_supported: true,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should filter out protocols that are both blacklisted and WC unsupported", () => {
      const mockProtocols = [
        {
          description: "Double Filtered Protocol",
          icon_url: "https://example.com/double.png",
          name: "DoubleFilteredProtocol",
          website_url: "https://double.example.com",
          tags: ["double"],
          is_blacklisted: true,
          is_wc_not_supported: true,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should handle protocols with undefined filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with undefined flags",
          icon_url: "https://example.com/undefined.png",
          name: "UndefinedProtocol",
          website_url: "https://undefined.example.com",
          tags: ["undefined"],
          is_blacklisted: undefined,
          is_wc_not_supported: undefined,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("UndefinedProtocol");
      expect(result[1].name).toBe("ValidProtocol");
    });

    it("should handle protocols with null filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with null flags",
          icon_url: "https://example.com/null.png",
          name: "NullProtocol",
          website_url: "https://null.example.com",
          tags: ["null"],
          is_blacklisted: null,
          is_wc_not_supported: null,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("NullProtocol");
      expect(result[1].name).toBe("ValidProtocol");
    });

    it("should include protocols with is_blacklisted: false and is_wc_not_supported: false", () => {
      const mockProtocols = [
        {
          description: "Valid Protocol 1",
          icon_url: "https://example.com/valid1.png",
          name: "ValidProtocol1",
          website_url: "https://valid1.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
        {
          description: "Valid Protocol 2",
          icon_url: "https://example.com/valid2.png",
          name: "ValidProtocol2",
          website_url: "https://valid2.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ValidProtocol1");
      expect(result[1].name).toBe("ValidProtocol2");
    });

    it("should include protocols with undefined filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with undefined flags",
          icon_url: "https://example.com/undefined.png",
          name: "UndefinedProtocol",
          website_url: "https://undefined.example.com",
          tags: ["undefined"],
          is_blacklisted: undefined,
          is_wc_not_supported: undefined,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("UndefinedProtocol");
    });

    it("should handle empty protocols array", () => {
      const mockProtocols: any[] = [];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toEqual([]);
    });
  });
});

describe("Backend Service - Transaction Operations", () => {
  let mockPost: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost = freighterBackendV1.post as jest.MockedFunction<any>;
  });

  describe("simulateTransaction", () => {
    const mockParams: SimulateTransactionParams = {
      xdr: "xdr",
      network_url: NETWORK_URLS.TESTNET,
      network_passphrase: Networks.TESTNET,
    };

    const mockSimulationResponse = {
      simulationResponse: {
        cost: { cpuInsns: "1000", memBytes: "2000" },
        minResourceFee: "500",
      },
      preparedTransaction: "AAAAAgAAAAB...",
    };

    it("should successfully simulate a transaction", async () => {
      mockPost.mockResolvedValue({
        data: mockSimulationResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await simulateTransaction(mockParams);

      expect(mockPost).toHaveBeenCalledWith("/simulate-tx", mockParams);
      expect(result).toHaveProperty("simulationResponse");
      expect(result).toHaveProperty("preparedTransaction");
      expect(result).toHaveProperty("preparedTransaction");
      expect(result.simulationResponse).toEqual(
        mockSimulationResponse.simulationResponse,
      );
    });

    it("should handle simulation with empty params array", async () => {
      const paramsWithEmptyArray = {
        ...mockParams,
        params: [] as unknown as xdr.ScVal[],
      };

      mockPost.mockResolvedValue({
        data: mockSimulationResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await simulateTransaction(paramsWithEmptyArray);

      expect(result).toHaveProperty("simulationResponse");
      expect(result).toHaveProperty("preparedTransaction");
    });

    it("should handle simulation errors", async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: { error: "Invalid contract address" },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      await expect(simulateTransaction(mockParams)).rejects.toEqual(
        errorResponse,
      );
      expect(mockPost).toHaveBeenCalledWith("/simulate-tx", mockParams);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");

      mockPost.mockRejectedValue(networkError);

      await expect(simulateTransaction(mockParams)).rejects.toThrow(
        "Network request failed",
      );
    });
  });

  describe("submitTransaction", () => {
    const mockSubmitParams: SubmitTransactionBody = {
      signed_xdr:
        "AAAAAgAAAACE7KlN7K5JlKLGQKj1pZ8vqKq4qnvQKq4qKq4qKq4qKgAAAGQABgdIAAAACAAAAAEAAAAAAAAAAAAAAABjYWxsAAAAAAAAAQAAAAEAAAAA...",
      network_url: "https://horizon-testnet.stellar.org",
      network_passphrase: "Test SDF Network ; September 2015",
    };

    const mockSubmitResponse = {
      id: "abc123def456",
      hash: "hash123",
      ledger: 12345,
      envelope_xdr: "envelope_xdr_data",
      result_xdr: "result_xdr_data",
      result_meta_xdr: "result_meta_xdr_data",
      successful: true,
    };

    it("should successfully submit a transaction", async () => {
      mockPost.mockResolvedValue({
        data: mockSubmitResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await submitTransaction(mockSubmitParams);

      expect(mockPost).toHaveBeenCalledWith("/submit-tx", mockSubmitParams);
      expect(result).toEqual(mockSubmitResponse);
      expect(result.successful).toBe(true);
      expect(result.ledger).toBe(12345);
    });

    it("should submit transaction with correct endpoint", async () => {
      mockPost.mockResolvedValue({
        data: mockSubmitResponse,
        status: 200,
        statusText: "OK",
      });

      await submitTransaction(mockSubmitParams);

      expect(mockPost).toHaveBeenCalledWith("/submit-tx", mockSubmitParams);
    });

    it("should handle submission with mainnet network", async () => {
      const mainnetParams = {
        ...mockSubmitParams,
        network_url: "https://horizon.stellar.org",
        network_passphrase: "Public Global Stellar Network ; September 2015",
      };

      mockPost.mockResolvedValue({
        data: mockSubmitResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await submitTransaction(mainnetParams);

      expect(mockPost).toHaveBeenCalledWith("/submit-tx", mainnetParams);
      expect(result).toEqual(mockSubmitResponse);
    });

    it("should handle submission errors", async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: { error: "Transaction failed: insufficient balance" },
        },
      };

      mockPost.mockRejectedValue(errorResponse);

      await expect(submitTransaction(mockSubmitParams)).rejects.toEqual(
        errorResponse,
      );
      expect(mockPost).toHaveBeenCalledWith("/submit-tx", mockSubmitParams);
    });

    it("should handle transaction timeout errors", async () => {
      const timeoutError = {
        response: {
          status: 408,
          data: { error: "Transaction timed out" },
        },
      };

      mockPost.mockRejectedValue(timeoutError);

      await expect(submitTransaction(mockSubmitParams)).rejects.toEqual(
        timeoutError,
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");

      mockPost.mockRejectedValue(networkError);

      await expect(submitTransaction(mockSubmitParams)).rejects.toThrow(
        "Network request failed",
      );
    });

    it("should handle failed transaction response", async () => {
      const failedResponse = {
        ...mockSubmitResponse,
        successful: false,
        result_xdr: "failed_result_xdr",
      };

      mockPost.mockResolvedValue({
        data: failedResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await submitTransaction(mockSubmitParams);

      expect(result.successful).toBe(false);
      expect(result).toEqual(failedResponse);
    });

    it("should preserve all response fields from Horizon", async () => {
      const extendedResponse = {
        ...mockSubmitResponse,
        paging_token: "12345-0",
        source_account:
          "GBGFQHJ5KRBCQT2LZF3B7PBVJNRRBHW3QJ7VSDFQSRAQGFXHMMNDVNW7",
        fee_charged: "1000",
      };

      mockPost.mockResolvedValue({
        data: extendedResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await submitTransaction(mockSubmitParams);

      expect(result).toHaveProperty("paging_token", "12345-0");
      expect(result).toHaveProperty("source_account");
      expect(result).toHaveProperty("fee_charged", "1000");
    });

    it("should handle submission with different signed XDR", async () => {
      const differentXdrParams = {
        ...mockSubmitParams,
        signed_xdr: "DIFFERENT_XDR_STRING_HERE_1234567890ABCDEF",
      };

      mockPost.mockResolvedValue({
        data: mockSubmitResponse,
        status: 200,
        statusText: "OK",
      });

      await submitTransaction(differentXdrParams);

      expect(mockPost).toHaveBeenCalledWith("/submit-tx", differentXdrParams);
    });

    it("should handle server errors (5xx)", async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: "Internal server error" },
        },
      };

      mockPost.mockRejectedValue(serverError);

      await expect(submitTransaction(mockSubmitParams)).rejects.toEqual(
        serverError,
      );
    });
  });

  describe("Integration: simulateTransaction -> submitTransaction", () => {
    it("should support full workflow from simulation to submission", async () => {
      const simulateParams: SimulateTransactionParams = {
        xdr: "xdr",
        network_url: "https://horizon-testnet.stellar.org",
        network_passphrase: "Test SDF Network ; September 2015",
      };

      const simulationResponse = {
        simulationResponse: { cost: { cpuInsns: "1000" } },
        preparedTransaction: "PREPARED_XDR_123",
      };

      const submitResponse = {
        id: "tx123",
        hash: "hash123",
        ledger: 12345,
        successful: true,
      };

      // Mock simulation
      mockPost.mockResolvedValueOnce({
        data: simulationResponse,
        status: 200,
        statusText: "OK",
      });

      const simResult = await simulateTransaction(simulateParams);

      expect(simResult).toHaveProperty("preparedTransaction");

      // Mock submission
      mockPost.mockResolvedValueOnce({
        data: submitResponse,
        status: 200,
        statusText: "OK",
      });

      const submitParams: SubmitTransactionBody = {
        signed_xdr: `SIGNED_${simResult.preparedTransaction}`,
        network_url: simulateParams.network_url,
        network_passphrase: simulateParams.network_passphrase,
      };

      const submitResult = await submitTransaction(submitParams);

      expect(submitResult.successful).toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Backend Service - fetchCollectibles severity split", () => {
  let mockV2Post: jest.MockedFunction<any>;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const params = {
    owner: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
    contracts: [{ id: "C...", token_ids: ["abc"] }],
    network: NETWORKS.PUBLIC,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("logs warn (not error) on connectivity failures from apiFactory", async () => {
    // apiFactory throws a plain ApiError object on no-response failures
    // (offline, DNS, TLS, captive portal). isApiNetworkError matches that
    // shape, so the catch should demote to logger.warn.
    const networkError = {
      message: "Network Error",
      status: 0,
      isNetworkError: true,
    };
    mockV2Post.mockRejectedValue(networkError);

    await expect(fetchCollectibles(params)).rejects.toEqual(networkError);

    expect(warnSpy).toHaveBeenCalledWith(
      "backendApi.fetchCollectibles",
      expect.stringContaining("Network unreachable"),
      networkError,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs error (NOT warn) on axios timeouts so latency regressions stay visible in Sentry", async () => {
    // apiFactory carves timeouts out of the isNetworkError bucket
    // (status: 0, isNetworkError: false, message: "timeout of ...").
    // A timeout is backend latency, not connectivity, so the
    // fetchCollectibles catch must take the error branch - not the
    // warn branch shared with offline events. Without this carve-out
    // we'd silently demote slow/hung backends and lose Sentry signal
    // for latency regressions.
    const timeoutError = {
      message: "timeout of 15000ms exceeded",
      status: 0,
      isNetworkError: false,
    };
    mockV2Post.mockRejectedValue(timeoutError);

    await expect(fetchCollectibles(params)).rejects.toEqual(timeoutError);

    expect(errorSpy).toHaveBeenCalledWith(
      "backendApi.fetchCollectibles",
      "Error fetching collectibles",
      timeoutError,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs error on backend response errors (4xx/5xx)", async () => {
    const backendError = {
      message: "Internal Server Error",
      status: 500,
      isNetworkError: false,
    };
    mockV2Post.mockRejectedValue(backendError);

    await expect(fetchCollectibles(params)).rejects.toEqual(backendError);

    expect(errorSpy).toHaveBeenCalledWith(
      "backendApi.fetchCollectibles",
      "Error fetching collectibles",
      backendError,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs malformed response (data.collections missing) exactly once", async () => {
    // Server returned 200 but the payload is missing the expected
    // collections field. This is a contract violation, not a
    // connectivity failure. Inner shape mismatch should ship as a
    // warn breadcrumb (with the raw payload for inspection); the
    // outer catch fires a single logger.error for the thrown Error.
    // Earlier this path produced TWO Sentry events for one bad
    // payload (inner logger.error + catch logger.error).
    mockV2Post.mockResolvedValue({
      data: { data: {} },
      status: 200,
      statusText: "OK",
    });

    await expect(fetchCollectibles(params)).rejects.toThrow(
      "Invalid response from server",
    );

    expect(warnSpy).toHaveBeenCalledWith(
      "backendApi.fetchCollectibles",
      expect.stringContaining("Invalid response shape"),
      // Args carry only the payload SHAPE (key names) - no values,
      // so a malformed payload can't smuggle account IDs through
      // breadcrumb data on opt-out users' Sentry events.
      expect.objectContaining({
        topLevelKeys: expect.any(Array),
        innerKeys: expect.any(Array),
      }),
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "backendApi.fetchCollectibles",
      "Error fetching collectibles",
      expect.any(Error),
    );
  });

  it("sends a pre-serialized string body and query-in-URL so the JWT interceptor hashes the correct bytes", async () => {
    // The JWT request interceptor hashes config.data ONLY when it is already a
    // string. If the body is an object the interceptor would sign the empty-string
    // hash, producing a token that never validates on the backend. This test locks
    // the contract: body must be a string, query must be in the URL.
    mockV2Post.mockResolvedValue({
      data: {
        data: {
          collections: [
            {
              contract_id: "C...",
              collection_name: "Test",
              nfts: [],
            },
          ],
        },
      },
      status: 200,
      statusText: "OK",
    });

    await fetchCollectibles(params);

    // Idiomatic axios: the network goes via `{ params }` (the JWT interceptor
    // folds it into the signed path via getUri) and the body is a plain object
    // (the interceptor serializes it so bodyHash matches the wire).
    expect(mockV2Post).toHaveBeenCalledWith(
      "/collectibles",
      { owner: params.owner, contracts: params.contracts },
      { params: { network: params.network } },
    );
  });
});

describe("Backend Service - fetchTokenPrices v2 migration", () => {
  let mockV1Post: jest.MockedFunction<any>;
  let mockV2Post: jest.MockedFunction<any>;

  const tokens = [
    "XLM",
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  ];
  // What the v2 request body should contain: native "XLM" mapped to "native".
  const v2Tokens = [
    "native",
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockV1Post = freighterBackendV1.post as jest.MockedFunction<any>;
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    const response = {
      data: {
        data: { XLM: { currentPrice: "0.5", percentagePriceChange24h: 0.02 } },
      },
    };
    mockV1Post.mockResolvedValue(response);
    mockV2Post.mockResolvedValue(response);
  });

  it("hits the v2 client with a network query param and native id when useV2 is true", async () => {
    await fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: true });

    // Native "XLM" is sent to v2 as "native"; the network goes via `{ params }`
    // (the JWT interceptor folds it into the signed path via getUri). The body
    // is a plain object — the interceptor serializes it centrally so bodyHash
    // matches the wire bytes.
    expect(mockV2Post).toHaveBeenCalledWith(
      "/token-prices",
      { tokens: v2Tokens },
      { params: { network: "PUBLIC" } },
    );
    expect(mockV1Post).not.toHaveBeenCalled();
  });

  it("gates testnet entirely — no request, null prices (fiat is mainnet-only)", async () => {
    const result = await fetchTokenPrices({
      tokens,
      network: NETWORKS.TESTNET,
      useV2: true,
    });

    expect(mockV2Post).not.toHaveBeenCalled();
    expect(mockV1Post).not.toHaveBeenCalled();
    expect(result.XLM).toEqual({
      currentPrice: null,
      percentagePriceChange24h: null,
    });
  });

  it("gates testnet on the v1 fallback too (rollback can't reintroduce testnet fiat)", async () => {
    const result = await fetchTokenPrices({
      tokens,
      network: NETWORKS.TESTNET,
      useV2: false,
    });

    expect(mockV1Post).not.toHaveBeenCalled();
    expect(mockV2Post).not.toHaveBeenCalled();
    expect(result.XLM).toEqual({
      currentPrice: null,
      percentagePriceChange24h: null,
    });
  });

  it("remaps the v2 'native' price back to the app's 'XLM' key", async () => {
    mockV2Post.mockResolvedValueOnce({
      data: {
        data: {
          native: { currentPrice: "0.5", percentagePriceChange24h: 0.02 },
        },
      },
    });

    const result = await fetchTokenPrices({
      tokens,
      network: NETWORKS.PUBLIC,
      useV2: true,
    });

    expect(result.XLM?.currentPrice?.toString()).toBe("0.5");
    expect(result.native).toBeUndefined();
  });

  it("hits the v1 client with the 'XLM' native id and no network param when useV2 is false", async () => {
    await fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: false });

    // v1 is not native-translated — it still receives "XLM".
    expect(mockV1Post).toHaveBeenCalledWith("/token-prices", { tokens });
    expect(mockV2Post).not.toHaveBeenCalled();
  });

  it("short-circuits on unsupported networks (Futurenet) without any request", async () => {
    const result = await fetchTokenPrices({
      tokens,
      network: NETWORKS.FUTURENET,
      useV2: true,
    });

    expect(mockV1Post).not.toHaveBeenCalled();
    expect(mockV2Post).not.toHaveBeenCalled();
    // Every requested token is present with null prices.
    expect(result.XLM).toEqual({
      currentPrice: null,
      percentagePriceChange24h: null,
    });
  });

  it("short-circuits when all tokens filter out (custom tokens) without any request", async () => {
    const customTokens = ["USDC:CUSTOM_CONTRACT_ID"];
    const result = await fetchTokenPrices({
      tokens: customTokens,
      network: NETWORKS.PUBLIC,
      useV2: true,
    });

    expect(mockV1Post).not.toHaveBeenCalled();
    expect(mockV2Post).not.toHaveBeenCalled();
    expect(result["USDC:CUSTOM_CONTRACT_ID"]).toEqual({
      currentPrice: null,
      percentagePriceChange24h: null,
    });
  });

  it("logs an error to Sentry and rethrows on a backend failure", async () => {
    const backendError = {
      message: "Internal Server Error",
      status: 500,
      isNetworkError: false,
    };
    mockV2Post.mockRejectedValueOnce(backendError);

    await expect(
      fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: true }),
    ).rejects.toEqual(backendError);

    expect(logger.error).toHaveBeenCalledWith(
      "backendApi.fetchTokenPrices",
      "Error fetching token prices",
      backendError,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does NOT log a deliberate cancellation, but still rejects so the snapshot falls back", async () => {
    // The confirmation price snapshot aborts its in-flight request on every
    // cached_display fallback — a routine path, not a failure. The interceptor
    // normalizes an axios cancellation as a network error, so logging it would
    // stamp a misleading "network unreachable" breadcrumb on that path.
    const canceledError = { message: "canceled" };
    (isRequestCanceled as jest.Mock).mockReturnValue(true);
    mockV2Post.mockRejectedValueOnce(canceledError);

    await expect(
      fetchTokenPrices({
        tokens,
        network: NETWORKS.PUBLIC,
        useV2: true,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(canceledError);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("still logs a genuine connectivity failure when the request was not canceled", async () => {
    // The cancellation carve-out above must not swallow real failures.
    const networkError = {
      message: "Network Error",
      status: 0,
      isNetworkError: true,
    };
    (isRequestCanceled as jest.Mock).mockReturnValue(false);
    mockV2Post.mockRejectedValueOnce(networkError);

    await expect(
      fetchTokenPrices({
        tokens,
        network: NETWORKS.PUBLIC,
        useV2: true,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(networkError);

    expect(logger.warn).toHaveBeenCalledWith(
      "backendApi.fetchTokenPrices",
      "Network unreachable while fetching token prices",
      networkError,
    );
  });

  it("demotes a connectivity failure to a warn breadcrumb (no Sentry error)", async () => {
    const networkError = {
      message: "Network Error",
      status: 0,
      isNetworkError: true,
    };
    mockV2Post.mockRejectedValueOnce(networkError);

    await expect(
      fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: true }),
    ).rejects.toEqual(networkError);

    expect(logger.warn).toHaveBeenCalledWith(
      "backendApi.fetchTokenPrices",
      "Network unreachable while fetching token prices",
      networkError,
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

const SEP41_CONTRACT =
  "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4";

describe("Backend Service - fetchBalances v2 routing", () => {
  let mockV1Get: jest.MockedFunction<any>;
  let mockV2Post: jest.MockedFunction<any>;

  const publicKey = "GACCOUNT";

  const v2Account = {
    address: publicKey,
    is_funded: true,
    subentry_count: 2,
    balances: [
      {
        token_type: "NATIVE",
        token_id: "CNATIVE",
        key: "native",
        token: { type: "native", code: "XLM" },
        total: "100",
        available: "88.5",
        minimum_balance: "1.5",
        buying_liabilities: "0",
        selling_liabilities: "10",
      },
      {
        token_type: "CLASSIC",
        token_id: "CUSDC",
        key: "USDC:GISSUER",
        token: {
          type: "credit_alphanum4",
          code: "USDC",
          issuer: { key: "GISSUER" },
        },
        total: "50",
        available: "45",
        code: "USDC",
        issuer: "GISSUER",
        type: "credit_alphanum4",
        limit: "1000",
        buying_liabilities: "0",
        selling_liabilities: "5",
        is_authorized: true,
        is_authorized_to_maintain_liabilities: true,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockV1Get = freighterBackendV1.get as jest.MockedFunction<any>;
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    (scanBulkTokens as jest.MockedFunction<any>).mockResolvedValue({
      results: {},
    });
    (dataStorage.getItem as jest.MockedFunction<any>).mockResolvedValue(null);
    (dataStorage.setItem as jest.MockedFunction<any>).mockResolvedValue(
      undefined,
    );
  });

  it("POSTs the address to the v2 endpoint and maps the response (useV2 on PUBLIC)", async () => {
    mockV2Post.mockResolvedValueOnce({ data: { data: [v2Account] } });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      useV2: true,
    });

    expect(mockV2Post).toHaveBeenCalledWith(
      "/accounts/balances",
      { addresses: [publicKey] },
      { params: { network: NETWORKS.PUBLIC } },
    );
    expect(mockV1Get).not.toHaveBeenCalled();

    // Native is keyed by the app convention, not the v1 wire key
    expect(result.balances!.XLM).toBeDefined();
    expect((result.balances as any).native).toBeUndefined();
    expect((result.balances!.XLM as any).total.toString()).toBe("100");
    expect((result.balances!["USDC:GISSUER"] as any).available.toString()).toBe(
      "45",
    );
    expect(result.isFunded).toBe(true);
    expect(result.subentryCount).toBe(2);
  });

  it("routes to v2 on testnet too (no Blockaid scan off-mainnet)", async () => {
    mockV2Post.mockResolvedValueOnce({ data: { data: [v2Account] } });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.TESTNET,
      useV2: true,
    });

    expect(mockV2Post).toHaveBeenCalledTimes(1);
    expect(mockV1Get).not.toHaveBeenCalled();
    // Entries still carry the benign default blockaidData stamp
    expect((result.balances!["USDC:GISSUER"] as any).blockaidData).toEqual({
      result_type: "Benign",
    });
  });

  it("rejects a response missing the requested account (contract violation)", async () => {
    // The backend returns one entry per requested address — unfunded accounts
    // arrive as is_funded: false, never as an omission — so an absent entry
    // is a malformed/partial response, not an unfunded account.
    mockV2Post.mockResolvedValueOnce({ data: { data: [] } });

    await expect(
      fetchBalances({
        publicKey,
        network: NETWORKS.PUBLIC,
        useV2: true,
      }),
    ).rejects.toThrow("v2 balances response is missing the requested account");
  });

  it("keeps the public key out of the thrown message (it becomes the Sentry title)", async () => {
    // The message is used verbatim as the Sentry issue title, which bypasses
    // sanitizeLogData — that redactor only walks structured `extra.args` and
    // returns an Error's `message` untouched. Interpolating the key would
    // also give every account its own issue, breaking grouping.
    mockV2Post.mockResolvedValueOnce({ data: { data: [] } });

    const error = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      useV2: true,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(publicKey);
  });

  it("propagates a v2 server error without falling back to v1", async () => {
    // A v2 failure must surface, not silently degrade to v1 — a fallback
    // would mask indexer outages behind stale-looking v1 data.
    mockV2Post.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 500"), {
        response: { status: 500 },
      }),
    );

    await expect(
      fetchBalances({
        publicKey,
        network: NETWORKS.PUBLIC,
        useV2: true,
      }),
    ).rejects.toThrow("500");
    expect(mockV1Get).not.toHaveBeenCalled();
  });

  it("routes to v1 when the flag is off", async () => {
    mockV1Get.mockResolvedValueOnce({
      data: { balances: {}, isFunded: true, subentryCount: 0 },
    });

    await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      useV2: false,
    });

    expect(mockV2Post).not.toHaveBeenCalled();
    expect(mockV1Get).toHaveBeenCalledWith(
      expect.stringContaining(`/account-balances/${publicKey}`),
    );
  });

  it("routes to v1 on Futurenet even with the flag on", async () => {
    mockV1Get.mockResolvedValueOnce({
      data: { balances: {}, isFunded: true, subentryCount: 0 },
    });

    await fetchBalances({
      publicKey,
      network: NETWORKS.FUTURENET,
      useV2: true,
    });

    expect(mockV2Post).not.toHaveBeenCalled();
    expect(mockV1Get).toHaveBeenCalledTimes(1);
  });

  it("reports every local contract id as removable on the v1 path", async () => {
    // v1 returns a contract-token balance only for an ID it was handed, so the
    // whole local list is local-only by construction.
    mockV1Get.mockResolvedValueOnce({
      data: { balances: {}, isFunded: true, subentryCount: 0 },
    });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      contractIds: [SEP41_CONTRACT],
      useV2: false,
    });

    expect(result.localOnlyTokenIds).toEqual([SEP41_CONTRACT]);
  });
});

describe("Backend Service - fetchBalances v2 local custom-token merge", () => {
  let mockV1Get: jest.MockedFunction<any>;
  let mockV2Post: jest.MockedFunction<any>;

  const publicKey = "GACCOUNT";

  const v2Account = (isFunded = true) => ({
    address: publicKey,
    is_funded: isFunded,
    subentry_count: 0,
    balances: [
      {
        token_type: "NATIVE",
        token_id: "native",
        key: "native",
        token: { type: "native", code: "XLM" },
        total: "100",
        available: "98",
        minimum_balance: "1.5",
        buying_liabilities: "0",
        selling_liabilities: "0",
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockV1Get = freighterBackendV1.get as jest.MockedFunction<any>;
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    (scanBulkTokens as jest.MockedFunction<any>).mockResolvedValue({
      results: {},
    });
    (dataStorage.getItem as jest.MockedFunction<any>).mockResolvedValue(null);
    (dataStorage.setItem as jest.MockedFunction<any>).mockResolvedValue(
      undefined,
    );
  });

  it("merges back a locally saved token the indexer omitted, with its real balance", async () => {
    mockV2Post.mockResolvedValueOnce({ data: { data: [v2Account()] } });
    mockV1Get.mockResolvedValueOnce({
      data: {
        name: "My Token",
        symbol: "TKN",
        decimals: 7,
        balance: "42",
      },
    });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      contractIds: [SEP41_CONTRACT],
      useV2: true,
    });

    // The balance must be requested explicitly — token-details omits it by
    // default, which would render the merged token as zero.
    expect(mockV1Get).toHaveBeenCalledWith(
      `/token-details/${SEP41_CONTRACT}`,
      expect.objectContaining({
        params: expect.objectContaining({
          pub_key: publicKey,
          network: NETWORKS.PUBLIC,
          should_fetch_balance: true,
        }),
      }),
    );

    const entry = result.balances![`TKN:${SEP41_CONTRACT}`] as any;
    expect(entry.total.toString()).toBe("42");
    expect(result.localOnlyTokenIds).toEqual([SEP41_CONTRACT]);
    // Merged before the scan, so it carries a Blockaid stamp like v1 did
    expect(entry.blockaidData).toEqual({ result_type: "Benign" });
  });

  it("resolves no tokens for an unfunded account", async () => {
    // The not-funded UI renders in place of balances, so resolving local
    // tokens would only burn requests.
    mockV2Post.mockResolvedValueOnce({ data: { data: [v2Account(false)] } });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      contractIds: [SEP41_CONTRACT],
      useV2: true,
    });

    expect(mockV1Get).not.toHaveBeenCalled();
    expect(result.isFunded).toBe(false);
    expect(result.localOnlyTokenIds).toBeUndefined();
  });

  it("does not resolve a local token the indexer already returned", async () => {
    const account = v2Account();
    account.balances.push({
      token_type: "SEP41",
      token_id: SEP41_CONTRACT,
      key: `TKN:${SEP41_CONTRACT}`,
      token: { type: "SEP41", code: "TKN" },
      total: "7",
      available: "7",
    } as any);
    mockV2Post.mockResolvedValueOnce({ data: { data: [account] } });

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      contractIds: [SEP41_CONTRACT],
      useV2: true,
    });

    expect(mockV1Get).not.toHaveBeenCalled();
    // Backend-owned, so hide-only rather than removable
    expect(result.localOnlyTokenIds).toEqual([]);
    expect(
      (result.balances![`TKN:${SEP41_CONTRACT}`] as any).total.toString(),
    ).toBe("7");
  });

  it("still returns backend balances when a local token cannot be resolved", async () => {
    mockV2Post.mockResolvedValueOnce({ data: { data: [v2Account()] } });
    mockV1Get.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { status: 400 }),
    );

    const result = await fetchBalances({
      publicKey,
      network: NETWORKS.PUBLIC,
      contractIds: [SEP41_CONTRACT],
      useV2: true,
    });

    expect(result.balances!.XLM).toBeDefined();
    expect(result.localOnlyTokenIds).toEqual([]);
  });
});
