import { AssetType } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NETWORK_URLS } from "config/constants";
import {
  AssetToken,
  BalanceMap,
  ClassicBalance,
  NativeBalance,
} from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";

// Mock the getIconUrlFromIssuer helper
jest.mock("helpers/getIconUrlFromIssuer", () => ({
  getIconUrlFromIssuer: jest.fn(),
}));

describe("assetIcons store", () => {
  const mockGetIconUrlFromIssuer = getIconUrlFromIssuer as jest.MockedFunction<
    typeof getIconUrlFromIssuer
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store before each test
    useAssetIconsStore.setState({
      icons: {},
      lastRefreshed: null,
    });
  });

  describe("fetchIconUrl", () => {
    const mockAsset: AssetToken = {
      code: "USDC",
      issuer: {
        key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
      type: "credit_alphanum4" as AssetType,
    };

    it("should return cached icon if available", async () => {
      const cachedIcon = {
        imageUrl: "https://example.com/icon.png",
        networkUrl: NETWORK_URLS.PUBLIC,
      };

      useAssetIconsStore.setState({
        icons: {
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
            cachedIcon,
        },
      });

      const result = await useAssetIconsStore.getState().fetchIconUrl({
        asset: mockAsset,
        networkUrl: NETWORK_URLS.PUBLIC,
      });

      expect(result).toEqual(cachedIcon);
      expect(mockGetIconUrlFromIssuer).not.toHaveBeenCalled();
    });

    it("should fetch and cache new icon for non-native asset", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrlFromIssuer.mockResolvedValue(mockIconUrl);

      const result = await useAssetIconsStore.getState().fetchIconUrl({
        asset: mockAsset,
        networkUrl: NETWORK_URLS.PUBLIC,
      });

      expect(result).toEqual({
        imageUrl: mockIconUrl,
        networkUrl: NETWORK_URLS.PUBLIC,
      });
      expect(mockGetIconUrlFromIssuer).toHaveBeenCalledWith({
        assetCode: mockAsset.code,
        issuerKey: mockAsset.issuer.key,
        networkUrl: NETWORK_URLS.PUBLIC,
      });
    });

    it("should handle errors gracefully", async () => {
      mockGetIconUrlFromIssuer.mockRejectedValue(new Error("Failed to fetch"));

      const result = await useAssetIconsStore.getState().fetchIconUrl({
        asset: mockAsset,
        networkUrl: NETWORK_URLS.PUBLIC,
      });

      expect(result).toEqual({
        imageUrl: "",
        networkUrl: NETWORK_URLS.PUBLIC,
      });
    });
  });

  describe("fetchBalancesIcons", () => {
    const mockBalances: BalanceMap = {
      XLM: {
        token: {
          code: "XLM",
          issuer: {
            key: "native",
          },
          type: "native" as const,
        },
        total: new BigNumber("100"),
        available: new BigNumber("100"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      } as NativeBalance,
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
        token: {
          code: "USDC",
          issuer: {
            key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
          type: "credit_alphanum4" as AssetType,
        },
        total: new BigNumber("200"),
        available: new BigNumber("200"),
        limit: new BigNumber("1000"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      } as ClassicBalance,
    };

    it("should fetch icons for all non-native assets", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrlFromIssuer.mockResolvedValue(mockIconUrl);

      await useAssetIconsStore.getState().fetchBalancesIcons({
        balances: mockBalances,
        networkUrl: NETWORK_URLS.PUBLIC,
      });

      expect(mockGetIconUrlFromIssuer).toHaveBeenCalledTimes(1);
      expect(mockGetIconUrlFromIssuer).toHaveBeenCalledWith({
        assetCode: "USDC",
        issuerKey: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        networkUrl: NETWORK_URLS.PUBLIC,
      });
    });
  });

  describe("refreshIcons", () => {
    it("should set lastRefreshed if not set", () => {
      useAssetIconsStore.getState().refreshIcons();
      expect(useAssetIconsStore.getState().lastRefreshed).toBeTruthy();
    });

    it("should not refresh if last refresh was less than 24 hours ago", () => {
      const now = Date.now();
      useAssetIconsStore.setState({
        lastRefreshed: now - 12 * 60 * 60 * 1000, // 12 hours ago
      });

      useAssetIconsStore.getState().refreshIcons();
      expect(mockGetIconUrlFromIssuer).not.toHaveBeenCalled();
    });

    it("should refresh icons if last refresh was more than 24 hours ago", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrlFromIssuer.mockResolvedValue(mockIconUrl);

      useAssetIconsStore.setState({
        lastRefreshed: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        icons: {
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
            imageUrl: "old-url",
            networkUrl: NETWORK_URLS.PUBLIC,
          },
        },
      });

      useAssetIconsStore.getState().refreshIcons();

      // Wait for the async operations to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(mockGetIconUrlFromIssuer).toHaveBeenCalled();
      expect(useAssetIconsStore.getState().lastRefreshed).toBeTruthy();
    });
  });
});
