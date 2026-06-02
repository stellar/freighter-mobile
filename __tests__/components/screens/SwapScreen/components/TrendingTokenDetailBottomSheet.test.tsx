import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { TrendingTokenDetailBottomSheet } from "components/screens/SwapScreen/components/TrendingTokenDetailBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    status: { success: "#00FF00" },
    text: { secondary: "#888888" },
    // Banner needs red/amber/lime/lilac at index 11 to render text color.
    red: { 3: "#FFE0E0", 6: "#FFB0B0", 9: "#FF4040", 11: "#CD2B31" },
    amber: { 3: "#FFF3E0", 6: "#FFD080", 9: "#FFAA40", 11: "#B97E00" },
    lime: { 3: "#E0FFE0", 6: "#A0F0A0", 9: "#40C040", 11: "#1F9133" },
    lilac: { 3: "#F2EEFF", 6: "#C5B6FF", 9: "#7B5BD8", 11: "#5746AF" },
  },
}));

jest.mock("components/TokenIconWithBadge", () => ({
  TokenIconWithBadge: () => null,
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

  it("special-cases native XLM in the info card: Stellar Network / stellar.org / Stellar Classic", () => {
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
    // Type label is "Stellar Classic" (not "Stellar Native") per spec.
    expect(getByText("Stellar Classic")).toBeTruthy();
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
    fireEvent.press(getByText(/Buy AQUA/i));
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
    fireEvent.press(getByText(/Buy AQUA/i));
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
    fireEvent.press(getByText(/Buy AQUA/i));

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
    fireEvent.press(getByText(/Buy AQUA/i));

    expect(setSourceSpy).not.toHaveBeenCalled();
    expect(setDestSpy).toHaveBeenCalled();
  });

  describe("Blockaid warning banners", () => {
    it("renders the malicious banner when record.securityLevel === MALICIOUS", () => {
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      expect(getByTestId("trending-detail-malicious-banner")).toBeTruthy();
    });

    it("renders the suspicious banner when record.securityLevel === SUSPICIOUS", () => {
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.SUSPICIOUS }}
          priceInfo={{}}
          balanceItems={[]}
        />,
      );
      expect(getByTestId("trending-detail-suspicious-banner")).toBeTruthy();
    });

    it("does NOT render a banner when securityLevel is SAFE / UNABLE_TO_SCAN / undefined", () => {
      const { queryByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.SAFE }}
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
      fireEvent.press(getByText(/Buy AQUA/i));
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRENDING_BUY_PRESSED,
        { tokenCode: "AQUA" },
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
      fireEvent.press(getByText(/Buy AQUA/i));
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DESTINATION_SELECTED,
        expect.objectContaining({ tokenCode: "AQUA", source: "trending" }),
      );
    });
  });
});
