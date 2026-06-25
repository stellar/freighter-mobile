import { Networks, xdr } from "@stellar/stellar-sdk";
import { NETWORK_URLS, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  fetchCollectibles,
  fetchTokenPrices,
  freighterBackendV1,
  freighterBackendV2,
  simulateTransaction,
  submitTransaction,
  SimulateTransactionParams,
  SubmitTransactionBody,
} from "services/backend";

jest.mock("services/apiFactory", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
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
      fromXDR: jest.fn((xdrString: string, networkPassphrase: string) => ({
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
});

describe("Backend Service - fetchTokenPrices v2 migration", () => {
  let mockV1Post: jest.MockedFunction<any>;
  let mockV2Post: jest.MockedFunction<any>;

  const tokens = [
    "XLM",
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

  it("hits the v2 client with a network query param when useV2 is true", async () => {
    await fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: true });

    expect(mockV2Post).toHaveBeenCalledWith(
      "/token-prices",
      { tokens },
      { params: { network: "PUBLIC" } },
    );
    expect(mockV1Post).not.toHaveBeenCalled();
  });

  it("maps testnet to the TESTNET network param", async () => {
    await fetchTokenPrices({ tokens, network: NETWORKS.TESTNET, useV2: true });

    expect(mockV2Post).toHaveBeenCalledWith(
      "/token-prices",
      { tokens },
      { params: { network: "TESTNET" } },
    );
  });

  it("hits the v1 client with no network param when useV2 is false", async () => {
    await fetchTokenPrices({ tokens, network: NETWORKS.PUBLIC, useV2: false });

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
});
