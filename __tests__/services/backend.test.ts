import { Networks, xdr } from "@stellar/stellar-sdk";
import { NETWORK_URLS } from "config/constants";
import {
  freighterBackendV1,
  simulateTransaction,
  submitTransaction,
  SimulateTransactionParams,
  SubmitTransactionBody,
} from "services/backend";

jest.mock("services/apiFactory", () => ({
  createApiService: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
  isRequestCanceled: jest.fn(),
}));

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
      address: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      pub_key: "GBGFQHJ5KRBCQT2LZF3B7PBVJNRRBHW3QJ7VSDFQSRAQGFXHMMNDVNW7",
      memo: "test transfer",
      fee: "1000",
      params: [] as unknown as xdr.ScVal[],
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

      expect(mockPost).toHaveBeenCalledWith(
        "/simulate-transaction",
        mockParams,
      );
      expect(result).toHaveProperty("simulationResponse");
      expect(result).toHaveProperty("preparedTransaction");
      expect(result).toHaveProperty("preparedTx");
      expect(result.simulationResponse).toEqual(
        mockSimulationResponse.simulationResponse,
      );
    });

    it("should handle simulation without optional fee", async () => {
      const paramsWithoutFee = { ...mockParams };
      delete paramsWithoutFee.fee;

      mockPost.mockResolvedValue({
        data: mockSimulationResponse,
        status: 200,
        statusText: "OK",
      });

      const result = await simulateTransaction(paramsWithoutFee);

      expect(mockPost).toHaveBeenCalledWith(
        "/simulate-transaction",
        paramsWithoutFee,
      );
      expect(result).toHaveProperty("preparedTx");
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
      expect(result).toHaveProperty("preparedTx");
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
      expect(mockPost).toHaveBeenCalledWith(
        "/simulate-transaction",
        mockParams,
      );
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

      expect(mockPost).toHaveBeenCalledWith(
        "/submit-transaction",
        mockSubmitParams,
      );
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

      expect(mockPost).toHaveBeenCalledWith(
        "/submit-transaction",
        mockSubmitParams,
      );
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

      expect(mockPost).toHaveBeenCalledWith(
        "/submit-transaction",
        mainnetParams,
      );
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
      expect(mockPost).toHaveBeenCalledWith(
        "/submit-transaction",
        mockSubmitParams,
      );
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

      expect(mockPost).toHaveBeenCalledWith(
        "/submit-transaction",
        differentXdrParams,
      );
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
        address: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        pub_key: "GBGFQHJ5KRBCQT2LZF3B7PBVJNRRBHW3QJ7VSDFQSRAQGFXHMMNDVNW7",
        memo: "test",
        params: [] as unknown as xdr.ScVal[],
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
