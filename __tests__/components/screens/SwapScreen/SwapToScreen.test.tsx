/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import * as useSwapTokenLookupModule from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { SwapToScreen } from "components/screens/SwapScreen/screens/SwapToScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { HookStatus, TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { analytics } from "services/analytics";

import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";

mockGestureHandler();

jest.mock("components/screens/SwapScreen/hooks/useSwapTokenLookup");

jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(() => ({
    setSourceToken: jest.fn(),
    setDestinationToken: jest.fn(),
    sourceTokenId: "XLM",
    destinationToken: null,
  })),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: [],
  })),
}));

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: {
    publicKey: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  },
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: "testnet" })),
}));

const mockGoBack = jest.fn();

type SwapToScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const makeNavigation = () =>
  ({
    goBack: mockGoBack,
  }) as unknown as SwapToScreenProps["navigation"];

const makeRoute = (selectionType: SWAP_SELECTION_TYPES) =>
  ({
    key: "swap-to-screen",
    name: SWAP_ROUTES.SWAP_SCREEN,
    params: { selectionType },
  }) as unknown as SwapToScreenProps["route"];

const mockNavProps = {
  navigation: makeNavigation(),
  route: makeRoute(SWAP_SELECTION_TYPES.DESTINATION),
};

const makeProps = (selectionType: SWAP_SELECTION_TYPES) => ({
  navigation: makeNavigation(),
  route: makeRoute(selectionType),
});

const mockHeldBalance = {
  id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  tokenCode: "USDC",
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "USDC",
    issuer: {
      key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
  },
  decimals: 7,
} as any;

const mockPopularRecord = {
  tokenCode: "AQUA",
  issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  hasTrustline: false,
  domain: "aqua.network",
};

const defaultLookupResult = {
  yourTokens: [],
  popularTokens: [],
  trendingTokens: [],
  searchResults: [],
  hadSorobanMatches: false,
  stellarExpertDown: false,
  status: HookStatus.SUCCESS,
  searchTerm: "",
  handleSearch: jest.fn(),
  resetSearch: jest.fn(),
};

describe("SwapToScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'Your tokens' + 'Popular tokens' headers in idle mode", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance],
      popularTokens: [mockPopularRecord],
    });

    const { getByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Your tokens")).toBeTruthy();
    expect(getByText("Popular tokens")).toBeTruthy();
  });

  it("renders 'Results' header (only) in active search mode", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance],
      popularTokens: [mockPopularRecord],
      searchResults: [mockPopularRecord],
      searchTerm: "aqua",
    });

    const { getByText, queryByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Results")).toBeTruthy();
    expect(queryByText("Your tokens")).toBeNull();
    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("renders the Soroban empty-state when hadSorobanMatches=true and searchResults is empty", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [],
      popularTokens: [],
      searchResults: [],
      hadSorobanMatches: true,
      searchTerm: "soroswap",
    });

    const { getByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(
      getByText(/Soroban contract tokens aren't supported for swaps yet/),
    ).toBeTruthy();
  });

  it("renders the stellar.expert-down notice when stellarExpertDown=true", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance],
      popularTokens: [],
      stellarExpertDown: true,
      status: HookStatus.ERROR,
    });

    const { getByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(
      getByText(/Token discovery is temporarily unavailable/),
    ).toBeTruthy();
  });

  it("renders only 'Your tokens' section when popularTokens is empty (e.g. SE down)", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance],
      popularTokens: [],
      stellarExpertDown: true,
      status: HookStatus.ERROR,
    });

    const { getByText, queryByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Your tokens")).toBeTruthy();
    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("hides the 'Popular tokens' section header in source mode", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance],
      popularTokens: [mockPopularRecord],
    });

    const { queryByText, getByText } = renderWithProviders(
      <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.SOURCE)} />,
    );

    expect(getByText("Your tokens")).toBeTruthy();
    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("renders the 'No tokens match' message for a search with zero classic results and no Soroban matches", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [],
      popularTokens: [],
      searchResults: [],
      hadSorobanMatches: false,
      searchTerm: "zloto",
    });

    const { getByText } = renderWithProviders(
      <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
    );

    expect(getByText(/No tokens match zloto/i)).toBeTruthy();
  });

  describe("Opposite-token exclusion", () => {
    const defaultStoreState = {
      setSourceToken: jest.fn(),
      setDestinationToken: jest.fn(),
      sourceTokenId: "XLM",
      destinationToken: null,
    };

    afterEach(() => {
      // Restore the default store state so tests outside this describe block
      // are not affected by the overrides in individual tests.
      (useSwapStore as unknown as jest.Mock).mockReturnValue(defaultStoreState);
    });

    const usdcBalance = {
      id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenCode: "USDC",
      token: {
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        code: "USDC",
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      },
      decimals: 7,
    } as any;

    const xlmBalance = {
      id: "XLM",
      tokenCode: "XLM",
      token: { type: "native" as const, code: "XLM" as const },
      decimals: 7,
    } as any;

    it("excludes the currently-selected source token from the destination picker (held balance)", () => {
      // sourceTokenId is USDC; we are picking the destination — USDC should
      // be hidden from the "Your tokens" list.
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: jest.fn(),
        setDestinationToken: jest.fn(),
        sourceTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        destinationToken: null,
      });

      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        // yourTokens contains USDC (the source) and XLM
        yourTokens: [usdcBalance, xlmBalance],
        popularTokens: [],
      });

      const { queryByText, getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
      );

      // XLM is still visible
      expect(getByText("XLM")).toBeTruthy();
      // USDC (the source token) must NOT appear
      expect(queryByText("USDC")).toBeNull();
    });

    it("excludes the currently-selected destination token from the source picker (held balance)", () => {
      // destinationToken is XLM; we are picking the source — XLM should be
      // hidden from the "Your tokens" list.
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: jest.fn(),
        setDestinationToken: jest.fn(),
        sourceTokenId: null,
        destinationToken: {
          id: "XLM",
          tokenCode: "XLM",
          issuer: undefined,
          decimals: 7,
          tokenType: "native",
          isNew: false,
        },
      });

      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [usdcBalance, xlmBalance],
        popularTokens: [],
      });

      const { queryByText, getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.SOURCE)} />,
      );

      // USDC is still visible
      expect(getByText("USDC")).toBeTruthy();
      // XLM (the destination token) must NOT appear
      expect(queryByText("XLM")).toBeNull();
    });

    it("excludes the source token from popular tokens section in destination mode", () => {
      const aquaRecord = {
        tokenCode: "AQUA",
        issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
        isNative: false,
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        hasTrustline: false,
        domain: "aqua.network",
      };

      // sourceTokenId is USDC; picking destination — USDC in popularTokens
      // should be excluded; AQUA should remain.
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: jest.fn(),
        setDestinationToken: jest.fn(),
        sourceTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        destinationToken: null,
      });

      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [],
        popularTokens: [
          {
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            isNative: false,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            hasTrustline: true,
            domain: "centre.io",
          },
          aquaRecord,
        ],
      });

      const { queryByText, getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
      );

      expect(getByText("AQUA")).toBeTruthy();
      expect(queryByText("USDC")).toBeNull();
    });
  });

  describe("Analytics events", () => {
    beforeEach(() => {
      jest.spyOn(analytics, "track").mockClear();
    });

    it("fires SWAP_DESTINATION_SELECTED with source:balances when a held token in 'Your tokens' is tapped", () => {
      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [mockHeldBalance],
        popularTokens: [],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...mockNavProps} />,
      );

      fireEvent.press(getByText("USDC"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.objectContaining({ source: "balances" }),
      );
    });

    it("fires SWAP_DESTINATION_SELECTED with source:popular when a non-held popular token is tapped", () => {
      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [],
        popularTokens: [mockPopularRecord],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...mockNavProps} />,
      );

      fireEvent.press(getByText("AQUA"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.objectContaining({ source: "popular", tokenCode: "AQUA" }),
      );
    });

    it("fires SWAP_DESTINATION_SELECTED with source:search when a result is tapped during active search", () => {
      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [],
        popularTokens: [],
        searchResults: [mockPopularRecord],
        searchTerm: "aqua",
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...mockNavProps} />,
      );

      fireEvent.press(getByText("AQUA"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.objectContaining({ source: "search", tokenCode: "AQUA" }),
      );
    });
  });
});
