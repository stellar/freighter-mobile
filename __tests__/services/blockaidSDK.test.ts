/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import BlockaidClient from "@blockaid/client";
import {
  scanSiteSDK,
  scanAssetSDK,
  scanTransactionSDK,
  isBlockaidSDKAvailable,
} from "services/blockaidSDK";
import type {
  ScanSiteParams,
  ScanAssetParams,
  ScanTxParams,
} from "types/blockaid";

// Mock BlockaidClient
jest.mock("@blockaid/client");
const MockedBlockaidClient = BlockaidClient as jest.MockedClass<
  typeof BlockaidClient
>;

// Mock logger
jest.mock("config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("blockaidSDK", () => {
  const originalEnv = process.env;
  const mockClient = {
    site: {
      scan: jest.fn(),
    },
    token: {
      scan: jest.fn(),
    },
    stellar: {
      transaction: {
        scan: jest.fn(),
      },
    },
  };

  // Sample test data
  const mockSiteParams: ScanSiteParams = {
    url: "https://example.com",
  };

  const mockAssetParams: ScanAssetParams = {
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    network: "public",
  };

  const mockTxParams: ScanTxParams = {
    xdr: "AAAA...XDR...",
    sourceAccount: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    network: "public",
  };

  const mockSiteResponse = {
    status: "safe",
    result_type: "benign",
    url: "https://example.com",
    is_malicious: false,
    is_web3_site: true,
  };

  const mockAssetResponse = {
    status: "safe",
    result_type: "benign",
    chain: "stellar",
    address: "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    metadata: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 7,
    },
  };

  const mockTxResponse = {
    status: "safe",
    result_type: "benign",
    validation: {
      status: "safe" as const,
      warnings: [],
      errors: [],
    },
    simulation: {
      status: "safe" as const,
      account_summary: {
        account_exposures: [],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    MockedBlockaidClient.mockImplementation(
      () => mockClient as unknown as BlockaidClient,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isBlockaidSDKAvailable", () => {
    it("returns true when API key is configured", () => {
      process.env.BLOCKAID_API_KEY = "test-api-key";
      expect(isBlockaidSDKAvailable()).toBe(true);
    });

    it("returns false when API key is not configured", () => {
      delete process.env.BLOCKAID_API_KEY;
      expect(isBlockaidSDKAvailable()).toBe(false);
    });
  });

  describe("scanSiteSDK", () => {
    beforeEach(() => {
      process.env.BLOCKAID_API_KEY = "test-api-key";
    });

    it("successfully scans a site", async () => {
      mockClient.site.scan.mockResolvedValue(mockSiteResponse);

      const result = await scanSiteSDK(mockSiteParams);

      expect(mockClient.site.scan).toHaveBeenCalledWith({
        url: "https://example.com",
      });
      expect(result).toEqual(mockSiteResponse);
    });

    it("handles API errors gracefully", async () => {
      const mockError = new Error("API Error");
      mockClient.site.scan.mockRejectedValue(mockError);

      const result = await scanSiteSDK(mockSiteParams);

      expect(result).toBeNull();
    });
  });

  describe("scanAssetSDK", () => {
    beforeEach(() => {
      process.env.BLOCKAID_API_KEY = "test-api-key";
    });

    it("successfully scans a regular asset", async () => {
      mockClient.token.scan.mockResolvedValue(mockAssetResponse);

      const result = await scanAssetSDK(mockAssetParams);

      expect(mockClient.token.scan).toHaveBeenCalledWith({
        address:
          "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        chain: "stellar",
      });
      expect(result).toEqual(mockAssetResponse);
    });

    it("formats XLM as native asset", async () => {
      const xlmParams: ScanAssetParams = {
        assetCode: "XLM",
        network: "public",
      };
      mockClient.token.scan.mockResolvedValue(mockAssetResponse);

      await scanAssetSDK(xlmParams);

      expect(mockClient.token.scan).toHaveBeenCalledWith({
        address: "XLM-native",
        chain: "stellar",
      });
    });
  });

  describe("scanTransactionSDK", () => {
    beforeEach(() => {
      process.env.BLOCKAID_API_KEY = "test-api-key";
    });

    it("successfully scans a transaction", async () => {
      mockClient.stellar.transaction.scan.mockResolvedValue(mockTxResponse);

      const result = await scanTransactionSDK(mockTxParams);

      expect(mockClient.stellar.transaction.scan).toHaveBeenCalledWith({
        transaction: "AAAA...XDR...",
        account_address:
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        chain: "pubnet",
        metadata: {},
      });
      expect(result).toEqual(mockTxResponse);
    });

    it("handles API errors and returns null for fallback", async () => {
      const mockError = new Error("Transaction format not supported");
      (mockError as { status?: number }).status = 422;
      mockClient.stellar.transaction.scan.mockRejectedValue(mockError);

      const result = await scanTransactionSDK(mockTxParams);

      expect(result).toBeNull();
    });
  });
});
