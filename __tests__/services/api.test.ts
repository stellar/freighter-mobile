/**
 * Tests for Blockaid API Service
 *
 * This test suite includes:
 * - URL parameter encoding tests
 * - API functionality tests
 */
import { NETWORKS } from "config/constants";
import { freighterBackend } from "services/backend";
import {
  scanToken,
  scanSite,
  scanBulkTokens,
  scanTransaction,
} from "services/blockaid/api";

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

describe("Blockaid API Service", () => {
  let mockGet: jest.MockedFunction<any>;
  let mockPost: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh mock functions for each test
    mockGet = freighterBackend.get as jest.MockedFunction<any>;
    mockPost = freighterBackend.post as jest.MockedFunction<any>;
  });

  describe("URL Parameter Encoding", () => {
    describe("scanToken", () => {
      it("should encode address parameter in query string", async () => {
        const tokenCode = "USDC";
        const tokenIssuer =
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { data: { risk: "low" }, error: null },
          status: 200,
          statusText: "OK",
        });

        await scanToken({ tokenCode, tokenIssuer, network });

        expect(mockGet).toHaveBeenCalledWith(
          "/scan-asset?address=USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        );
      });
    });

    describe("scanSite", () => {
      it("should encode URL parameter in query string", async () => {
        const url = "https://app.stellarx.com/markets?asset=USDC";
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { data: { risk: "low" }, error: null },
          status: 200,
          statusText: "OK",
        });

        await scanSite({ url, network });

        expect(mockGet).toHaveBeenCalledWith(
          "/scan-dapp?url=https%3A%2F%2Fapp.stellarx.com%2Fmarkets%3Fasset%3DUSDC",
        );
      });
    });

    describe("scanBulkTokens", () => {
      it("should encode multiple address parameters in query string", async () => {
        const addressList = [
          "XLM",
          "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          "TEST-GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
        ];
        const network = NETWORKS.PUBLIC;

        mockGet.mockResolvedValue({
          data: { data: { results: [] }, error: null },
          status: 200,
          statusText: "OK",
        });

        await scanBulkTokens({ addressList, network });

        expect(mockGet).toHaveBeenCalledWith(
          "/scan-asset-bulk?asset_ids=XLM&asset_ids=USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&asset_ids=TEST-GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
          { signal: undefined },
        );
      });
    });

    describe("scanTransaction", () => {
      it("should encode URL parameter in request body", async () => {
        const url = "https://app.stellarx.com/markets?asset=USDC";
        const xdr = "mock-xdr-data";
        const network = NETWORKS.PUBLIC;

        mockPost.mockResolvedValue({
          data: { data: { risk: "low" }, error: null },
          status: 200,
          statusText: "OK",
        });

        await scanTransaction({ url, xdr, network });

        expect(mockPost).toHaveBeenCalledWith("/scan-tx", {
          url: "https%3A%2F%2Fapp.stellarx.com%2Fmarkets%3Fasset%3DUSDC",
          tx_xdr: xdr,
          network,
        });
      });
    });
  });

  describe("Real-world Examples", () => {
    it("should handle real dApp URLs with query parameters", async () => {
      const url = "https://app.stellarx.com/markets?asset=USDC";
      const network = NETWORKS.PUBLIC;

      mockGet.mockResolvedValue({
        data: { data: { risk: "low" }, error: null },
        status: 200,
        statusText: "OK",
      });

      await scanSite({ url, network });

      expect(mockGet).toHaveBeenCalledWith(
        "/scan-dapp?url=https%3A%2F%2Fapp.stellarx.com%2Fmarkets%3Fasset%3DUSDC",
      );
    });

    it("should handle complex URLs with multiple parameters", async () => {
      const url =
        "https://example.com/path?param1=value1&param2=value2&param3=value3";
      const network = NETWORKS.PUBLIC;

      mockGet.mockResolvedValue({
        data: { data: { risk: "low" }, error: null },
        status: 200,
        statusText: "OK",
      });

      await scanSite({ url, network });

      expect(mockGet).toHaveBeenCalledWith(
        "/scan-dapp?url=https%3A%2F%2Fexample.com%2Fpath%3Fparam1%3Dvalue1%26param2%3Dvalue2%26param3%3Dvalue3",
      );
    });
  });

  describe("Bulk Operations", () => {
    it("should handle empty address list gracefully", async () => {
      const addressList: string[] = [];
      const network = NETWORKS.PUBLIC;

      mockGet.mockResolvedValue({
        data: { data: { results: [] }, error: null },
        status: 200,
        statusText: "OK",
      });

      await scanBulkTokens({ addressList, network });

      expect(mockGet).toHaveBeenCalledWith("/scan-asset-bulk?", {
        signal: undefined,
      });
    });
  });
});
