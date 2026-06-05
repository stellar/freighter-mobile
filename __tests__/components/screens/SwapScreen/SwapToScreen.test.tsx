/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
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
  heldSearchMatches: [],
  verifiedSearchMatches: [],
  unverifiedSearchMatches: [],
  hadSorobanMatches: false,
  stellarExpertDown: false,
  status: HookStatus.SUCCESS,
  isTrendingLoading: false,
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

    expect(getByText("Your token")).toBeTruthy();
    expect(getByText("Popular tokens")).toBeTruthy();
  });

  it("uses the plural 'Your tokens' title when the held bucket has 2+ entries", () => {
    const extraHeldBalance = {
      ...mockHeldBalance,
      id: "XLM",
      tokenCode: "XLM",
    };
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [mockHeldBalance, extraHeldBalance],
      popularTokens: [],
    });

    const { getByText, queryByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Your tokens")).toBeTruthy();
    expect(queryByText("Your token")).toBeNull();
  });

  it("renders (i) info buttons on the Verified and Unverified section headers only", () => {
    const mockHeldRecord = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: true,
      domain: "circle.com",
    };
    const mockUnverifiedRecord = {
      tokenCode: "FOO",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: false,
      domain: "foo.com",
    };
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      heldSearchMatches: [mockHeldRecord],
      verifiedSearchMatches: [mockPopularRecord],
      unverifiedSearchMatches: [mockUnverifiedRecord],
      searchTerm: "u",
    });

    const { getByTestId, queryByTestId } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByTestId("swap-to-verified-info-button")).toBeTruthy();
    expect(getByTestId("swap-to-unverified-info-button")).toBeTruthy();
    // No (i) button next to "Your token" / "Popular tokens".
    expect(queryByTestId("swap-to-held-info-button")).toBeNull();
    expect(queryByTestId("swap-to-popular-info-button")).toBeNull();
  });

  it("renders Your tokens / Verified / Unverified section headers in active search mode", () => {
    const mockHeldRecord = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: true,
      domain: "circle.com",
    };
    const mockUnverifiedRecord = {
      tokenCode: "FOO",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: false,
      domain: "foo.com",
    };
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      heldSearchMatches: [mockHeldRecord],
      verifiedSearchMatches: [mockPopularRecord],
      unverifiedSearchMatches: [mockUnverifiedRecord],
      searchTerm: "u",
    });

    const { getByText, queryByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Your token")).toBeTruthy();
    expect(getByText("Verified")).toBeTruthy();
    expect(getByText("Unverified")).toBeTruthy();
    // The single flat "Results" header is gone now.
    expect(queryByText("Results")).toBeNull();
    // Idle-only "Popular tokens" header must not appear in active search.
    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("omits empty section headers in active search mode", () => {
    const mockHeldRecord = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      isNative: false,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      hasTrustline: true,
      domain: "circle.com",
    };
    // Only held bucket populated; verified + unverified empty.
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      heldSearchMatches: [mockHeldRecord],
      verifiedSearchMatches: [],
      unverifiedSearchMatches: [],
      searchTerm: "usdc",
    });

    const { getByText, queryByText } = renderWithProviders(
      <SwapToScreen {...mockNavProps} />,
    );

    expect(getByText("Your token")).toBeTruthy();
    // Empty buckets must not render their section headers.
    expect(queryByText("Verified")).toBeNull();
    expect(queryByText("Unverified")).toBeNull();
  });

  it("renders the Soroban empty-state when hadSorobanMatches=true and all search buckets are empty", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [],
      popularTokens: [],
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

    expect(getByText("Your token")).toBeTruthy();
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

    expect(getByText("Your token")).toBeTruthy();
    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("renders the 'No tokens match' message for a search with zero classic results and no Soroban matches", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [],
      popularTokens: [],
      hadSorobanMatches: false,
      searchTerm: "zloto",
    });

    const { getByText } = renderWithProviders(
      <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
    );

    expect(getByText(/No tokens match zloto/i)).toBeTruthy();
  });

  it("shows a loading spinner while the active search is fetching (takes precedence over empty-state copy)", () => {
    (useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock).mockReturnValue({
      ...defaultLookupResult,
      yourTokens: [],
      popularTokens: [],
      hadSorobanMatches: false,
      status: HookStatus.LOADING,
      searchTerm: "usd",
    });

    const { getByTestId, queryByText } = renderWithProviders(
      <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
    );

    // Spinner must be visible
    expect(getByTestId("search-loading-spinner")).toBeTruthy();
    // Neither the Soroban message nor the no-results message should appear
    expect(queryByText(/Soroban contract tokens aren't supported/)).toBeNull();
    expect(queryByText(/No tokens match/i)).toBeNull();
    // The Results section header must not appear while still loading
    expect(queryByText("Results")).toBeNull();
  });

  describe("Selection-swap rule (spec §12.4)", () => {
    // Behaviour: opposite-side tokens are NO LONGER hidden — the user can
    // pick the same token on either side, and when they do, the opposite
    // side's picker resets to "Select" so they can pick something else
    // there.
    const defaultStoreState = {
      setSourceToken: jest.fn(),
      setDestinationToken: jest.fn(),
      sourceTokenId: "XLM",
      destinationToken: null,
    };

    afterEach(() => {
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
      total: new BigNumber("250"),
      decimals: 7,
    } as any;

    const xlmBalance = {
      id: "XLM",
      tokenCode: "XLM",
      token: { type: "native" as const, code: "XLM" as const },
      total: new BigNumber("1000"),
      decimals: 7,
    } as any;

    it("opposite-side token is NOT hidden from the picker (both sides visible)", () => {
      // sourceTokenId is USDC; we open the destination picker — USDC should
      // STILL appear in the list (the user might want to swap their USDC
      // selection to the destination side).
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
        yourTokens: [usdcBalance, xlmBalance],
        popularTokens: [],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
      );

      // Both XLM and USDC must be visible
      expect(getByText("XLM")).toBeTruthy();
      expect(getByText("USDC")).toBeTruthy();
    });

    it("picking a destination that equals the current source clears the source", () => {
      const setSourceTokenSpy = jest.fn();
      const setDestinationTokenSpy = jest.fn();
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: setSourceTokenSpy,
        setDestinationToken: setDestinationTokenSpy,
        // Source is USDC; user opens destination picker and taps USDC.
        sourceTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        destinationToken: null,
      });

      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [usdcBalance, xlmBalance],
        popularTokens: [],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
      );

      fireEvent.press(getByText("USDC"));

      // Source is cleared (set to empty strings) before destination is set.
      expect(setSourceTokenSpy).toHaveBeenCalledWith("", "");
      // Destination is set to USDC.
      expect(setDestinationTokenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenCode: "USDC",
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      );
    });

    it("picking a source that equals the current destination clears the destination", () => {
      const setSourceTokenSpy = jest.fn();
      const setDestinationTokenSpy = jest.fn();
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: setSourceTokenSpy,
        setDestinationToken: setDestinationTokenSpy,
        // Destination is XLM; user opens source picker and taps XLM.
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

      const { getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.SOURCE)} />,
      );

      fireEvent.press(getByText("XLM"));

      // Destination is cleared (null) before source is set.
      expect(setDestinationTokenSpy).toHaveBeenCalledWith(null);
      // Source is set to XLM.
      expect(setSourceTokenSpy).toHaveBeenCalledWith("XLM", "XLM");
    });

    it("picking a Popular-section token equal to the source clears the source", () => {
      const setSourceTokenSpy = jest.fn();
      const setDestinationTokenSpy = jest.fn();
      const usdcRecord = {
        tokenCode: "USDC",
        issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        isNative: false,
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        hasTrustline: true,
        domain: "centre.io",
      };

      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        setSourceToken: setSourceTokenSpy,
        setDestinationToken: setDestinationTokenSpy,
        sourceTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        destinationToken: null,
      });

      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [],
        popularTokens: [usdcRecord],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.DESTINATION)} />,
      );

      fireEvent.press(getByText("USDC"));

      expect(setSourceTokenSpy).toHaveBeenCalledWith("", "");
      expect(setDestinationTokenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tokenCode: "USDC" }),
      );
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
        verifiedSearchMatches: [mockPopularRecord],
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

    it("fires SWAP_SOURCE_SELECTED (not SWAP_DESTINATION_SELECTED) with source:balances when a held token is tapped in SOURCE mode", () => {
      (
        useSwapTokenLookupModule.useSwapTokenLookup as jest.Mock
      ).mockReturnValue({
        ...defaultLookupResult,
        yourTokens: [mockHeldBalance],
        popularTokens: [],
      });

      const { getByText } = renderWithProviders(
        <SwapToScreen {...makeProps(SWAP_SELECTION_TYPES.SOURCE)} />,
      );

      fireEvent.press(getByText("USDC"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_SOURCE_SELECTED,
        expect.objectContaining({
          source: "balances",
          tokenCode: "USDC",
          tokenIssuer:
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      );
      // Negative: SOURCE-mode press must NOT fire the destination event.
      expect(analytics.track).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.anything(),
      );
    });
  });
});
