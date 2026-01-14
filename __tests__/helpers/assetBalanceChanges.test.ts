import { AssetBalanceChange } from "components/screens/HistoryScreen/types";
import {
  TESTNET_NETWORK_DETAILS,
  NATIVE_TOKEN_CODE,
  DEFAULT_DECIMALS,
  NETWORKS,
} from "config/constants";
import {
  processAssetBalanceChanges,
  normalizePaymentToAssetDiffs,
} from "helpers/assetBalanceChanges";
import { getIconUrl } from "helpers/getIconUrl";

// Mock dependencies
jest.mock("helpers/getIconUrl");
jest.mock("config/logger");

const mockGetIconUrl = getIconUrl as jest.MockedFunction<typeof getIconUrl>;

const mockPublicKey =
  "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const mockOtherKey1 = "GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY";
const mockOtherKey2 =
  "GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";
const mockIssuerKey = "GISSUERZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";
const mockIconUrl = "https://icon-url.com/icon.png";

// Native asset change fixtures
const nativeAssetChange: AssetBalanceChange = {
  asset_type: "native",
  type: "create_account",
  from: mockOtherKey1,
  to: mockPublicKey,
  amount: "100.0000000",
};

// Credit asset change fixtures (alphanum4)
const creditAssetChange: AssetBalanceChange = {
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: mockIssuerKey,
  type: "payment",
  from: mockPublicKey,
  to: mockOtherKey1,
  amount: "50.0000000",
};

// Credit asset change fixtures (alphanum12)
const creditAssetChange12: AssetBalanceChange = {
  asset_type: "credit_alphanum12",
  asset_code: "LONGASSETNAME",
  asset_issuer: mockIssuerKey,
  type: "payment",
  from: mockOtherKey1,
  to: mockPublicKey,
  amount: "25.0000000",
};

describe("processAssetBalanceChanges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIconUrl.mockResolvedValue(mockIconUrl);
  });

  describe("processing all changes (not filtering by user)", () => {
    it("should process changes where user is sender", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockPublicKey, to: mockOtherKey1 },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[0].isCredit).toBe(false); // User is sending
      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should process changes where user is receiver", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockOtherKey1, to: mockPublicKey },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[0].isCredit).toBe(true); // User is receiving
      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should process changes where user is neither sender nor receiver", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockOtherKey1, to: mockOtherKey2 },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // CRITICAL: This tests the new behavior - should still process
      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[0].isCredit).toBe(false); // to !== publicKey
      expect(result[0].destination).toBe(mockOtherKey2);
    });

    it("should process multiple changes including non-user changes", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockPublicKey, to: mockOtherKey1 },
          { ...creditAssetChange, from: mockOtherKey1, to: mockOtherKey2 },
          { ...creditAssetChange12, from: mockOtherKey2, to: mockPublicKey },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // Should return 3 diffs, not just 2
      expect(result).toHaveLength(3);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[1].assetCode).toBe("USDC");
      expect(result[2].assetCode).toBe("LONGASSETNAME");
    });
  });

  describe("decimals handling", () => {
    it("should use DEFAULT_DECIMALS constant for native assets", async () => {
      const operation = {
        asset_balance_changes: [nativeAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });

    it("should use DEFAULT_DECIMALS constant for credit_alphanum4 assets", async () => {
      const operation = {
        asset_balance_changes: [creditAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });

    it("should use DEFAULT_DECIMALS constant for credit_alphanum12 assets", async () => {
      const operation = {
        asset_balance_changes: [creditAssetChange12],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });
  });

  describe("asset type handling", () => {
    it("should handle native assets correctly", async () => {
      const operation = {
        asset_balance_changes: [nativeAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[0].assetIssuer).toBeNull();
      expect(result[0].amount).toBe("100.0000000");
    });

    it("should handle credit_alphanum4 assets correctly", async () => {
      const operation = {
        asset_balance_changes: [creditAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe("USDC");
      expect(result[0].assetIssuer).toBe(mockIssuerKey);
      expect(result[0].amount).toBe("50.0000000");
    });

    it("should handle credit_alphanum12 assets correctly", async () => {
      const operation = {
        asset_balance_changes: [creditAssetChange12],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe("LONGASSETNAME");
      expect(result[0].assetIssuer).toBe(mockIssuerKey);
      expect(result[0].amount).toBe("25.0000000");
    });

    it("should handle unknown asset types gracefully", async () => {
      const operation = {
        asset_balance_changes: [
          {
            ...nativeAssetChange,
            asset_type: "unknown_type",
          },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // Should filter out null results from unknown types
      expect(result).toHaveLength(0);
    });

    it("should handle missing asset_code in credit assets", async () => {
      const operation = {
        asset_balance_changes: [
          {
            ...creditAssetChange,
            asset_code: undefined,
          },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe("");
    });

    it("should handle missing asset_issuer in credit assets", async () => {
      const operation = {
        asset_balance_changes: [
          {
            ...creditAssetChange,
            asset_issuer: undefined,
          },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toHaveLength(1);
      expect(result[0].assetIssuer).toBeNull();
    });
  });

  describe("credit/debit detection", () => {
    it("should mark as credit when user receives funds", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockOtherKey1, to: mockPublicKey },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].isCredit).toBe(true);
      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should mark as debit when user sends funds", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockPublicKey, to: mockOtherKey1 },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].isCredit).toBe(false);
      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should mark as debit for non-user transfers (to !== publicKey)", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockOtherKey1, to: mockOtherKey2 },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // isCredit = to === publicKey, so when to !== publicKey, isCredit = false
      expect(result[0].isCredit).toBe(false);
      expect(result[0].destination).toBe(mockOtherKey2);
    });
  });

  describe("destination handling", () => {
    it("should set destination to sender when user receives", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockOtherKey1, to: mockPublicKey },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should set destination to receiver when user sends", async () => {
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockPublicKey, to: mockOtherKey1 },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should not include destination when it equals publicKey", async () => {
      // Edge case: self-transfer (though unlikely in practice)
      const operation = {
        asset_balance_changes: [
          { ...nativeAssetChange, from: mockPublicKey, to: mockPublicKey },
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result[0].destination).toBeUndefined();
    });
  });

  describe("icon fetching", () => {
    it("should fetch and include icon URL for native assets", async () => {
      const operation = {
        asset_balance_changes: [nativeAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: NATIVE_TOKEN_CODE,
          issuer: undefined,
        },
        network: NETWORKS.TESTNET,
      });
      expect(result[0].icon).toBe(mockIconUrl);
    });

    it("should fetch and include icon URL for credit assets", async () => {
      const operation = {
        asset_balance_changes: [creditAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: "USDC",
          issuer: mockIssuerKey,
        },
        network: NETWORKS.TESTNET,
      });
      expect(result[0].icon).toBe(mockIconUrl);
    });

    it("should handle icon fetch failures gracefully", async () => {
      mockGetIconUrl.mockRejectedValue(new Error("Network error"));

      const operation = {
        asset_balance_changes: [nativeAssetChange],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // Should still return result without icon
      expect(result).toHaveLength(1);
      expect(result[0].icon).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should return empty array when operation has no asset_balance_changes property", async () => {
      const operation = {
        id: "123",
        type: "payment",
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when asset_balance_changes is undefined", async () => {
      const operation = {
        asset_balance_changes: undefined,
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when asset_balance_changes is empty array", async () => {
      const operation = {
        asset_balance_changes: [],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      expect(result).toEqual([]);
    });

    it("should filter out null results from failed processings", async () => {
      const operation = {
        asset_balance_changes: [
          nativeAssetChange,
          { ...nativeAssetChange, asset_type: "unknown" },
          creditAssetChange,
        ],
      } as any;

      const result = await processAssetBalanceChanges(
        operation,
        mockPublicKey,
        TESTNET_NETWORK_DETAILS,
      );

      // Should only return 2 results (native and credit), filtering out the unknown type
      expect(result).toHaveLength(2);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[1].assetCode).toBe("USDC");
    });
  });
});

describe("normalizePaymentToAssetDiffs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIconUrl.mockResolvedValue(mockIconUrl);
  });

  describe("decimals handling", () => {
    it("should use DEFAULT_DECIMALS constant for native payments", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });

    it("should use DEFAULT_DECIMALS constant for credit asset payments", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: "USDC",
        assetIssuer: mockIssuerKey,
        amount: "50.0000000",
        isCredit: false,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });
  });

  describe("payment normalization", () => {
    it("should normalize native payment to asset diff", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
      expect(result[0].assetIssuer).toBeNull();
      expect(result[0].amount).toBe("100.0000000");
      expect(result[0].isCredit).toBe(true);
      expect(result[0].destination).toBe(mockOtherKey1);
      expect(result[0].decimals).toBe(DEFAULT_DECIMALS);
    });

    it("should normalize credit asset payment to asset diff", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: "USDC",
        assetIssuer: mockIssuerKey,
        amount: "50.0000000",
        isCredit: false,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe("USDC");
      expect(result[0].assetIssuer).toBe(mockIssuerKey);
      expect(result[0].amount).toBe("50.0000000");
      expect(result[0].isCredit).toBe(false);
      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should include destination when provided", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result[0].destination).toBe(mockOtherKey1);
    });

    it("should preserve isCredit flag correctly for credits", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result[0].isCredit).toBe(true);
    });

    it("should preserve isCredit flag correctly for debits", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: false,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(result[0].isCredit).toBe(false);
    });
  });

  describe("icon fetching", () => {
    it("should fetch and include icon URL for native assets", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: NATIVE_TOKEN_CODE,
          issuer: undefined,
        },
        network: NETWORKS.TESTNET,
      });
      expect(result[0].icon).toBe(mockIconUrl);
    });

    it("should fetch and include icon URL for credit assets", async () => {
      const result = await normalizePaymentToAssetDiffs({
        assetCode: "USDC",
        assetIssuer: mockIssuerKey,
        amount: "50.0000000",
        isCredit: false,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: "USDC",
          issuer: mockIssuerKey,
        },
        network: NETWORKS.TESTNET,
      });
      expect(result[0].icon).toBe(mockIconUrl);
    });

    it("should handle icon fetch failures gracefully", async () => {
      mockGetIconUrl.mockRejectedValue(new Error("Failed to fetch icon"));

      const result = await normalizePaymentToAssetDiffs({
        assetCode: NATIVE_TOKEN_CODE,
        assetIssuer: null,
        amount: "100.0000000",
        isCredit: true,
        destination: mockOtherKey1,
        networkDetails: TESTNET_NETWORK_DETAILS,
      });

      // Should still work without icon
      expect(result).toHaveLength(1);
      expect(result[0].icon).toBeUndefined();
      expect(result[0].assetCode).toBe(NATIVE_TOKEN_CODE);
    });
  });
});
