import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import {
  NonNativeToken,
  TokenTypeWithCustomToken,
  BalanceMap,
  ClassicBalance,
  NativeBalance,
} from "config/types";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getIconUrl } from "helpers/getIconUrl";
import { TokenListReponseItem } from "services/verified-token-lists";

// Mock verified tokens service
jest.mock("services/verified-token-lists", () => ({
  fetchVerifiedTokens: jest.fn(),
  TOKEN_LISTS_API_SERVICES: {},
}));

// Mock the verified tokens store
jest.mock("ducks/verifiedTokens");

// Mock the getIconUrl helper
jest.mock("helpers/getIconUrl", () => ({
  getIconUrl: jest.fn(),
}));

// Mock the logos asset
jest.mock("assets/logos", () => ({
  logos: {
    usdc: "bundled-usdc-logo.png",
    stellar: "bundled-stellar-logo.png",
  },
}));

// Time constants for tests
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TWENTY_FIVE_HOURS = 25 * 60 * 60 * 1000;

describe("tokenIcons store", () => {
  const mockGetIconUrl = getIconUrl as jest.MockedFunction<typeof getIconUrl>;
  const mockGetVerifiedTokens = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store before each test
    useTokenIconsStore.setState({
      icons: {},
      lastRefreshed: null,
    });
    // Reset verified tokens store mock
    (useVerifiedTokensStore.getState as jest.Mock) = jest.fn(() => ({
      getVerifiedTokens: mockGetVerifiedTokens,
    }));
  });

  describe("fetchIconUrl", () => {
    const mockToken: NonNativeToken = {
      code: "USDC",
      issuer: {
        key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
      type: TokenTypeWithCustomToken.CREDIT_ALPHANUM12,
    };

    it("should return bundled icon for Circle USDC on mainnet", async () => {
      const result = await useTokenIconsStore.getState().fetchIconUrl({
        token: mockToken,
        network: NETWORKS.PUBLIC,
      });

      expect(result).toEqual({
        imageUrl: "bundled-usdc-logo.png",
        network: NETWORKS.PUBLIC,
      });
      expect(mockGetIconUrl).not.toHaveBeenCalled();

      // Should also cache the bundled icon
      expect(
        useTokenIconsStore.getState().icons[
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ],
      ).toEqual({
        imageUrl: "bundled-usdc-logo.png",
        network: NETWORKS.PUBLIC,
      });
    });

    it("should return cached icon if available for non-USDC tokens", async () => {
      const cachedIcon = {
        imageUrl: "https://example.com/icon.png",
        network: NETWORKS.PUBLIC,
      };

      const btcToken: NonNativeToken = {
        code: "BTC",
        issuer: {
          key: "GABC123",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      };

      useTokenIconsStore.setState({
        icons: {
          "BTC:GABC123": cachedIcon,
        },
      });

      const result = await useTokenIconsStore.getState().fetchIconUrl({
        token: btcToken,
        network: NETWORKS.PUBLIC,
      });

      expect(result).toEqual(cachedIcon);
      expect(mockGetIconUrl).not.toHaveBeenCalled();
    });

    it("should fetch and cache new icon for non-native token", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrl.mockResolvedValue(mockIconUrl);

      const btcToken: NonNativeToken = {
        code: "BTC",
        issuer: {
          key: "GABC123",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      };

      const result = await useTokenIconsStore.getState().fetchIconUrl({
        token: btcToken,
        network: NETWORKS.PUBLIC,
      });

      expect(result).toEqual({
        imageUrl: mockIconUrl,
        network: NETWORKS.PUBLIC,
      });
      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: btcToken.code,
          issuer: btcToken.issuer.key,
        },
        network: NETWORKS.PUBLIC,
      });
    });

    it("should handle errors gracefully", async () => {
      mockGetIconUrl.mockRejectedValue(new Error("Failed to fetch"));

      const btcToken: NonNativeToken = {
        code: "BTC",
        issuer: {
          key: "GABC123",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      };

      const result = await useTokenIconsStore.getState().fetchIconUrl({
        token: btcToken,
        network: NETWORKS.PUBLIC,
      });

      expect(result).toEqual({
        imageUrl: "",
        network: NETWORKS.PUBLIC,
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
          type: TokenTypeWithCustomToken.NATIVE,
        },
        total: new BigNumber("100"),
        available: new BigNumber("100"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      } as NativeBalance,
      "BTC:GABC123": {
        token: {
          code: "BTC",
          issuer: {
            key: "GABC123",
          },
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        },
        total: new BigNumber("200"),
        available: new BigNumber("200"),
        limit: new BigNumber("1000"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      } as ClassicBalance,
    };

    it("should fetch icons for all non-native tokens", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrl.mockResolvedValue(mockIconUrl);

      await useTokenIconsStore.getState().fetchBalancesIcons({
        balances: mockBalances,
        network: NETWORKS.PUBLIC,
      });

      expect(mockGetIconUrl).toHaveBeenCalledTimes(1);
      expect(mockGetIconUrl).toHaveBeenCalledWith({
        asset: {
          code: "BTC",
          issuer: "GABC123",
        },
        network: NETWORKS.PUBLIC,
      });
    });

    it("should use bundled icon for Circle USDC on mainnet", async () => {
      const mockBalancesWithUSDC: BalanceMap = {
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
          token: {
            code: "USDC",
            issuer: {
              key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            },
            type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          },
          total: new BigNumber("200"),
          available: new BigNumber("200"),
          limit: new BigNumber("1000"),
          buyingLiabilities: "0",
          sellingLiabilities: "0",
        } as ClassicBalance,
      };

      await useTokenIconsStore.getState().fetchBalancesIcons({
        balances: mockBalancesWithUSDC,
        network: NETWORKS.PUBLIC,
      });

      // Should not call getIconUrl for Circle USDC
      expect(mockGetIconUrl).not.toHaveBeenCalled();

      // Should have cached the bundled icon
      expect(
        useTokenIconsStore.getState().icons[
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ],
      ).toEqual({
        imageUrl: "bundled-usdc-logo.png",
        network: NETWORKS.PUBLIC,
      });
    });
  });

  describe("refreshIcons", () => {
    it("should set lastRefreshed if not set", () => {
      useTokenIconsStore.getState().refreshIcons();
      expect(useTokenIconsStore.getState().lastRefreshed).toBeTruthy();
    });

    it("should not refresh if last refresh was less than 24 hours ago", () => {
      const now = Date.now();
      useTokenIconsStore.setState({
        lastRefreshed: now - TWELVE_HOURS,
      });

      useTokenIconsStore.getState().refreshIcons();
      expect(mockGetIconUrl).not.toHaveBeenCalled();
    });

    it("should refresh icons if last refresh was more than 24 hours ago", async () => {
      const mockIconUrl = "https://example.com/icon.png";
      mockGetIconUrl.mockResolvedValue(mockIconUrl);

      useTokenIconsStore.setState({
        lastRefreshed: Date.now() - TWENTY_FIVE_HOURS,
        icons: {
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
            imageUrl: "old-url",
            network: NETWORKS.PUBLIC,
          },
        },
      });

      useTokenIconsStore.getState().refreshIcons();

      // Wait for the async operations to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(mockGetIconUrl).toHaveBeenCalled();
      expect(useTokenIconsStore.getState().lastRefreshed).toBeTruthy();
    });
  });

  describe("cacheTokenIcons", () => {
    it("should add new icons to the store", () => {
      const newIcons = {
        "USDC:ISSUER1": {
          imageUrl: "https://example.com/usdc.png",
          network: NETWORKS.PUBLIC,
        },
      };

      useTokenIconsStore.getState().cacheTokenIcons({ icons: newIcons });

      expect(useTokenIconsStore.getState().icons["USDC:ISSUER1"]).toEqual(
        newIcons["USDC:ISSUER1"],
      );
    });

    it("should merge icons without removing existing ones", () => {
      const existingIcon = {
        "BTC:ISSUER2": {
          imageUrl: "https://example.com/btc.png",
          network: NETWORKS.TESTNET,
        },
      };

      useTokenIconsStore.setState({ icons: existingIcon });

      const newIcons = {
        "USDC:ISSUER1": {
          imageUrl: "https://example.com/usdc.png",
          network: NETWORKS.PUBLIC,
        },
      };

      useTokenIconsStore.getState().cacheTokenIcons({ icons: newIcons });

      expect(useTokenIconsStore.getState().icons).toEqual({
        ...existingIcon,
        ...newIcons,
      });
    });
  });

  describe("cacheTokenListIcons", () => {
    it("should fetch verified tokens and cache their icons", async () => {
      const mockVerifiedTokens: TokenListReponseItem[] = [
        {
          code: "USDC",
          issuer: "GA123",
          icon: "https://example.com/usdc.png",
          contract: "C123",
          domain: "example.com",
          decimals: 7,
        },
        {
          code: "BTC",
          issuer: "GB456",
          icon: "https://example.com/btc.png",
          domain: "example.com",
          decimals: 7,
          contract: "",
          // no contract for BTC
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      await useTokenIconsStore
        .getState()
        .cacheTokenListIcons({ network: NETWORKS.PUBLIC });

      const { icons } = useTokenIconsStore.getState();

      expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
        network: NETWORKS.PUBLIC,
      });

      expect(icons).toMatchObject({
        "USDC:GA123": {
          imageUrl: "https://example.com/usdc.png",
          network: NETWORKS.PUBLIC,
        },
        "USDC:C123": {
          imageUrl: "https://example.com/usdc.png",
          network: NETWORKS.PUBLIC,
        },
        "BTC:GB456": {
          imageUrl: "https://example.com/btc.png",
          network: NETWORKS.PUBLIC,
        },
      });
    });

    it("should ignore tokens without icon field", async () => {
      mockGetVerifiedTokens.mockResolvedValue([
        {
          code: "NOICON",
          issuer: "GA999",
          contract: "",
          domain: "example.com",
          icon: "",
          decimals: 7,
          // no icon
        },
      ] as TokenListReponseItem[]);

      await useTokenIconsStore
        .getState()
        .cacheTokenListIcons({ network: NETWORKS.PUBLIC });

      const { icons } = useTokenIconsStore.getState();

      expect(icons).toEqual({});
    });

    it("should replace Circle USDC icon with bundled logo on mainnet", async () => {
      const mockVerifiedTokens: TokenListReponseItem[] = [
        {
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          icon: "https://token-list.com/usdc.png",
          contract: "CUSDC123",
          domain: "circle.com",
          decimals: 7,
        },
        {
          code: "BTC",
          issuer: "GB456",
          icon: "https://example.com/btc.png",
          domain: "example.com",
          decimals: 7,
          contract: "",
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      await useTokenIconsStore
        .getState()
        .cacheTokenListIcons({ network: NETWORKS.PUBLIC });

      const { icons } = useTokenIconsStore.getState();

      // Circle USDC should have the bundled icon
      expect(
        icons["USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],
      ).toEqual({
        imageUrl: "bundled-usdc-logo.png",
        network: NETWORKS.PUBLIC,
      });

      // Other tokens should have their original token list icons
      expect(icons["BTC:GB456"]).toEqual({
        imageUrl: "https://example.com/btc.png",
        network: NETWORKS.PUBLIC,
      });
    });

    it("should not replace USDC icon on testnet", async () => {
      const mockVerifiedTokens: TokenListReponseItem[] = [
        {
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          icon: "https://token-list.com/usdc.png",
          contract: "CUSDC123",
          domain: "circle.com",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      await useTokenIconsStore
        .getState()
        .cacheTokenListIcons({ network: NETWORKS.TESTNET });

      const { icons } = useTokenIconsStore.getState();

      // On testnet, should keep the token list icon
      expect(
        icons["USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],
      ).toEqual({
        imageUrl: "https://token-list.com/usdc.png",
        network: NETWORKS.TESTNET,
      });
    });
  });
});
