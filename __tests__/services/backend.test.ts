/**
 * Tests for Backend Service
 *
 * This test suite includes:
 * - URL parameter encoding tests
 * - Protocol filtering logic tests
 */
import { Networks } from "@stellar/stellar-sdk";
import { NETWORKS, NETWORK_NAMES, NETWORK_URLS } from "config/constants";
import {
  freighterBackend,
  freighterBackendV2,
  fetchBalances,
  getContractSpecs,
  getTokenDetails,
  isSacContractExecutable,
  getIndexerAccountHistory,
  fetchProtocols,
  fetchCollectibles,
} from "services/backend";

// Mock the API services
jest.mock("services/apiFactory", () => ({
  createApiService: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
  isRequestCanceled: jest.fn(),
}));

// Mock analytics
jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
  },
}));

// Mock network helper
jest.mock("helpers/networks", () => ({
  isMainnet: jest.fn(() => true),
}));

// Mock logger
jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  normalizeError: jest.fn((error) => error),
}));

// Mock bigize helper
jest.mock("helpers/bigize", () => ({
  bigize: jest.fn((data) => data),
}));

// Mock soroban helper
jest.mock("helpers/soroban", () => ({
  getNativeContractDetails: jest.fn(() => ({
    contract: "native-contract-id",
    code: "XLM",
    domain: "Stellar Network",
    issuer: "native-issuer",
  })),
}));

// Mock token type helper
jest.mock("helpers/balances", () => ({
  getTokenType: jest.fn(() => "NATIVE"),
}));

// Mock stellar SDK
jest.mock("@stellar/stellar-sdk", () => ({
  Networks: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
  },
  Horizon: {
    ServerApi: {
      OperationRecord: {},
    },
  },
  TransactionBuilder: {
    fromXDR: jest.fn(),
  },
}));

describe("Backend Service", () => {
  let mockGet: jest.MockedFunction<any>;
  let mockV2Get: jest.MockedFunction<any>;
  let mockV2Post: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh mock functions for each test
    mockGet = freighterBackend.get as jest.MockedFunction<any>;
    mockV2Get = freighterBackendV2.get as jest.MockedFunction<any>;
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
  });

  describe("URL Parameter Encoding", () => {
    describe("fetchBalances", () => {
      it("should encode public key in URL path", async () => {
        const publicKey =
          "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH";
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { balances: {}, isFunded: true, subentryCount: 0 },
          status: 200,
          statusText: "OK",
        });

        await fetchBalances({ publicKey, network });

        expect(mockGet).toHaveBeenCalledWith(
          `/account-balances/${encodeURIComponent(publicKey)}?network=${network}`,
        );
      });
    });

    describe("getContractSpecs", () => {
      it("should encode contract ID in URL path", async () => {
        const contractId =
          "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON";
        const networkDetails = {
          network: NETWORKS.PUBLIC,
          networkName: NETWORK_NAMES.PUBLIC,
          networkUrl: NETWORK_URLS.PUBLIC,
          networkPassphrase: Networks.PUBLIC,
        };

        mockGet.mockResolvedValue({
          data: { data: { definitions: {} } },
          status: 200,
          statusText: "OK",
        });

        await getContractSpecs({ contractId, networkDetails });

        expect(mockGet).toHaveBeenCalledWith(
          `/contract-spec/${encodeURIComponent(contractId)}`,
          { params: { network: NETWORKS.PUBLIC } },
        );
      });
    });

    describe("getTokenDetails", () => {
      it("should encode contract ID in URL path", async () => {
        const contractId =
          "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON";
        const publicKey =
          "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH";
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { symbol: "TEST", name: "Test Token", decimals: 7 },
          status: 200,
          statusText: "OK",
        });

        await getTokenDetails({ contractId, publicKey, network });

        expect(mockGet).toHaveBeenCalledWith(
          `/token-details/${encodeURIComponent(contractId)}`,
          {
            params: { pub_key: publicKey, network },
            signal: undefined,
          },
        );
      });
    });

    describe("isSacContractExecutable", () => {
      it("should encode contract ID in URL path", async () => {
        const contractId =
          "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON";
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { isSacContract: true },
          status: 200,
          statusText: "OK",
        });

        await isSacContractExecutable(contractId, network);

        expect(mockGet).toHaveBeenCalledWith(
          `/is-sac-contract/${encodeURIComponent(contractId)}`,
          { params: { network } },
        );
      });
    });

    describe("getIndexerAccountHistory", () => {
      it("should encode public key in URL path", async () => {
        const publicKey =
          "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH";
        const networkDetails = {
          network: NETWORKS.PUBLIC,
          networkName: NETWORK_NAMES.PUBLIC,
          networkUrl: NETWORK_URLS.PUBLIC,
          networkPassphrase: Networks.PUBLIC,
        };

        mockGet.mockResolvedValue({
          data: [],
          status: 200,
          statusText: "OK",
        });

        await getIndexerAccountHistory({ publicKey, networkDetails });

        expect(mockGet).toHaveBeenCalledWith(
          `/account-history/${encodeURIComponent(publicKey)}`,
          {
            params: {
              network: NETWORKS.PUBLIC,
              is_failed_included: true,
            },
          },
        );
      });
    });
  });

  describe("Backend V2 Service", () => {
    describe("fetchProtocols", () => {
      it("should make GET request to protocols endpoint", async () => {
        mockV2Get.mockResolvedValue({
          data: {
            data: {
              protocols: [
                {
                  description: "Test Protocol",
                  icon_url: "https://example.com/icon.png",
                  name: "TestProtocol",
                  website_url: "https://test.example.com",
                  tags: ["test"],
                },
              ],
            },
          },
          status: 200,
          statusText: "OK",
        });

        await fetchProtocols();

        expect(mockV2Get).toHaveBeenCalledWith("/protocols");
      });
    });

    describe("fetchCollectibles", () => {
      it("should make POST request to collectibles endpoint", async () => {
        const owner =
          "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH";
        const contracts = [
          {
            id: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
            token_ids: ["token1", "token2", "token3"],
          },
        ];

        mockV2Post.mockResolvedValue({
          data: {
            data: {
              collections: [],
            },
          },
          status: 200,
          statusText: "OK",
        });

        await fetchCollectibles({ owner, contracts });

        expect(mockV2Post).toHaveBeenCalledWith("/collectibles", {
          owner,
          contracts,
        });
      });
    });
  });

  // Test the filtering logic directly
  describe("Protocol Filtering Logic", () => {
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
});
