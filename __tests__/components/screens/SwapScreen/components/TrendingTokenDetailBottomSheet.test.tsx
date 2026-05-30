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
