import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { TrendingTokenDetailBottomSheet } from "components/screens/SwapScreen/components/TrendingTokenDetailBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { analytics } from "services/analytics";

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    status: { success: "#00FF00" },
    text: { secondary: "#888888" },
    foreground: { primary: "#707070" },
  },
}));

jest.mock("components/TokenIconWithBadge", () => ({
  TokenIconWithBadge: () => null,
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const mockRecord = {
  tokenCode: "AQUA",
  issuer: "GBN4RQUEFLBV6WFQNXOCSYBQLZYCTNLM34NQ35OWBGVRMJKWSXNZJBJ",
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  hasTrustline: false,
  domain: "aqua.network",
  decimals: 7,
} as any;

describe("TrendingTokenDetailBottomSheet", () => {
  it("renders tokenCode, price, and delta", () => {
    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{
          currentPrice: new BigNumber("0.05"),
          percentagePriceChange24h: new BigNumber("3.4"),
        }}
        balanceItems={[]}
      />,
    );
    // tokenCode shown (as fallback name since no record.name)
    expect(getByText("AQUA")).toBeTruthy();
    // Price renders via formatFiatAmount — match loosely
    expect(getByText(/0\.05/)).toBeTruthy();
    // delta renders with + sign and % — match loosely
    expect(getByText(/3\.4/)).toBeTruthy();
  });

  it("renders domain in the info card row", () => {
    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{
          currentPrice: new BigNumber("0.05"),
          percentagePriceChange24h: new BigNumber("3.4"),
        }}
        balanceItems={[]}
      />,
    );
    // Domain is now in the info card, not freestanding
    expect(getByText("aqua.network")).toBeTruthy();
  });

  it("renders truncated issuer in the info card row", () => {
    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        balanceItems={[]}
      />,
    );
    // Issuer truncated via truncateAddress (4+4 chars with "...")
    expect(getByText(/GBN4\.\.\.ZJBJ/)).toBeTruthy();
  });

  it("special-cases native XLM in the info card: Stellar Network / stellar.org", () => {
    const xlmRecord = {
      tokenCode: "XLM",
      issuer: "",
      isNative: true,
      // Stellar.expert may not return a domain for native — the special
      // case should display "stellar.org" anyway.
      domain: "",
      tokenType: undefined,
      hasTrustline: true,
    } as any;

    const { getByText, queryByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={xlmRecord}
        priceInfo={{}}
        balanceItems={[]}
      />,
    );

    expect(getByText("Stellar Network")).toBeTruthy();
    expect(getByText("stellar.org")).toBeTruthy();
    // The Type row was dropped — confirm it's no longer rendered.
    expect(queryByText(/Stellar Classic/)).toBeNull();
    expect(queryByText(/Stellar Native/)).toBeNull();
    // The "—" issuer fallback must NOT appear for XLM.
    expect(queryByText("—")).toBeNull();
  });

  it("hides the delta line when percentagePriceChange24h is undefined", () => {
    const { getByText, queryByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{ currentPrice: new BigNumber("0.05") }}
        balanceItems={[]}
      />,
    );
    // Price is shown
    expect(getByText(/0\.05/)).toBeTruthy();
    // No % text should be present (formatPercentageAmount always adds %)
    expect(queryByText(/%/)).toBeNull();
  });

  it("hides the delta line when currentPrice is undefined", () => {
    const { queryByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{ percentagePriceChange24h: new BigNumber("3.4") }}
        balanceItems={[]}
      />,
    );
    // No % text (no delta rendered without currentPrice)
    expect(queryByText(/%/)).toBeNull();
  });

  it("'Buy' CTA dispatches descriptorFromSearchRecord (isNew: true) when token NOT held", () => {
    const setDestSpy = jest.fn();
    useSwapStore.setState({ setDestinationToken: setDestSpy } as any);

    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        balanceItems={[]}
      />,
    );
    fireEvent.press(getByText(/Swap to AQUA/i));
    expect(setDestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenCode: "AQUA", isNew: true }),
    );
  });

  it("'Buy' CTA dispatches descriptorFromBalance (isNew: false) when token IS held", () => {
    const setDestSpy = jest.fn();
    useSwapStore.setState({ setDestinationToken: setDestSpy } as any);

    const heldBalance = {
      id: "AQUA:GBN4RQUEFLBV6WFQNXOCSYBQLZYCTNLM34NQ35OWBGVRMJKWSXNZJBJ",
      tokenCode: "AQUA",
      token: {
        code: "AQUA",
        issuer: {
          key: "GBN4RQUEFLBV6WFQNXOCSYBQLZYCTNLM34NQ35OWBGVRMJKWSXNZJBJ",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      },
      decimals: 7,
    } as any;

    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        balanceItems={[heldBalance]}
      />,
    );
    fireEvent.press(getByText(/Swap to AQUA/i));
    expect(setDestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenCode: "AQUA", isNew: false }),
    );
  });

  it("Selection-swap rule: clears source when Buy picks a token that's already the source", () => {
    // Source is AQUA; user opens the Trending detail sheet for AQUA and
    // taps Buy. Source must clear so we don't end up with AQUA on both
    // sides (parity with the SwapToScreen selection-swap rule).
    const setDestSpy = jest.fn();
    const setSourceSpy = jest.fn();
    useSwapStore.setState({
      setDestinationToken: setDestSpy,
      setSourceToken: setSourceSpy,
      // Match mockRecord.issuer exactly so the constructed descriptor.id
      // collides with sourceTokenId and the selection-swap rule fires.
      sourceTokenId: `${mockRecord.tokenCode}:${mockRecord.issuer}`,
    } as any);

    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        balanceItems={[]}
      />,
    );
    fireEvent.press(getByText(/Swap to AQUA/i));

    expect(setSourceSpy).toHaveBeenCalledWith("", "");
    expect(setDestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenCode: "AQUA" }),
    );
  });

  it("Selection-swap rule: does NOT clear source when Buy picks a different token", () => {
    const setDestSpy = jest.fn();
    const setSourceSpy = jest.fn();
    useSwapStore.setState({
      setDestinationToken: setDestSpy,
      setSourceToken: setSourceSpy,
      // Source is XLM; user buys AQUA — no collision, source stays.
      sourceTokenId: "XLM",
    } as any);

    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        balanceItems={[]}
      />,
    );
    fireEvent.press(getByText(/Swap to AQUA/i));

    expect(setSourceSpy).not.toHaveBeenCalled();
    expect(setDestSpy).toHaveBeenCalled();
  });

  describe("copy issuer key", () => {
    beforeEach(() => {
      mockCopyToClipboard.mockClear();
    });

    it("copies the FULL issuer key (not the truncated label) when the issuer row is tapped", () => {
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      fireEvent.press(getByTestId("trending-detail-copy-issuer"));
      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        mockRecord.issuer,
        expect.objectContaining({ notificationMessage: expect.any(String) }),
      );
    });

    it("does NOT render a copy button when the record is native XLM (no issuer key to copy)", () => {
      const xlmRecord = {
        tokenCode: "XLM",
        issuer: "",
        isNative: true,
        domain: "",
        tokenType: undefined,
        hasTrustline: true,
      } as any;
      const { queryByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={xlmRecord}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      expect(queryByTestId("trending-detail-copy-issuer")).toBeNull();
    });
  });

  describe("Blockaid security signal", () => {
    // The full transaction-level Blockaid rescan happens in the swap review
    // sheet — this bottom sheet intentionally renders no inline banner. The
    // securityLevel still drives the small badge overlay on
    // TokenIconWithBadge above as a hint.
    it("does NOT render an inline warning banner regardless of securityLevel", () => {
      const { queryByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      expect(queryByTestId("trending-detail-malicious-banner")).toBeNull();
      expect(queryByTestId("trending-detail-suspicious-banner")).toBeNull();
    });
  });

  describe("Analytics events", () => {
    beforeEach(() => {
      jest.spyOn(analytics, "track").mockClear();
    });

    it("fires SWAP_TRENDING_BUY_PRESSED with tokenCode when the Buy CTA is pressed", () => {
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      fireEvent.press(getByText(/Swap to AQUA/i));
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRENDING_BUY_PRESSED,
        expect.objectContaining({
          tokenCode: "AQUA",
          tokenIssuer: mockRecord.issuer,
        }),
      );
    });

    it("fires SWAP_DESTINATION_SELECTED with source:trending when the Buy CTA is pressed", () => {
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      fireEvent.press(getByText(/Swap to AQUA/i));
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.objectContaining({ tokenCode: "AQUA", source: "trending" }),
      );
    });
  });
});
