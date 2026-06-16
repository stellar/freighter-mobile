import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { TrendingTokenDetailBottomSheet } from "components/screens/SwapScreen/components/TrendingTokenDetailBottomSheet";
import { TokenTypeWithCustomToken } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SecurityLevel } from "services/blockaid/constants";

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    status: { success: "#00FF00" },
    text: { secondary: "#888888" },
    foreground: { primary: "#707070" },
    // Banner reads variant-specific palettes from themeColors.<color>[11] —
    // include the variants the trending-detail security banner can render
    // (error/warning/info/success) so the component doesn't throw when
    // resolving its text color in flagged-state tests.
    red: { 11: "#FF0000" },
    amber: { 11: "#FFA000" },
    green: { 11: "#00AA00" },
    navy: { 11: "#0000AA" },
    lilac: { 11: "#AA00AA" },
  },
}));

jest.mock("components/TokenIconWithBadge", () => ({
  TokenIconWithBadge: () => null,
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

// Real AQUA issuer — exactly 56 chars so getTokenSacAddress can derive a
// valid SAC C-address. The previous mock issuer was 49 chars which made
// `new Asset()` throw and forced the component into the G-address fallback,
// invalidating the C-address tests below.
const mockRecord = {
  tokenCode: "AQUA",
  issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  hasTrustline: false,
  domain: "aqua.network",
  decimals: 7,
} as any;

const noop = () => {};

describe("TrendingTokenDetailBottomSheet", () => {
  it("renders tokenCode, price, and delta", () => {
    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{
          currentPrice: new BigNumber("0.05"),
          percentagePriceChange24h: new BigNumber("3.4"),
        }}
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    expect(getByText("AQUA")).toBeTruthy();
    expect(getByText(/0\.05/)).toBeTruthy();
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
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    expect(getByText("aqua.network")).toBeTruthy();
  });

  it("renders truncated SAC C-address on the Issuer row for classic assets", () => {
    const { getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{}}
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    // SAC derivation yields a C… address — the row shows its truncated form
    // (e.g. "CAQU...XYZ"). truncateAddress uses three ASCII dots, not the
    // Unicode ellipsis character.
    expect(getByText(/^C[A-Z0-9]{3}\.\.\.[A-Z0-9]{4}$/)).toBeTruthy();
  });

  it("special-cases native XLM in the info card: Stellar Network / stellar.org", () => {
    const xlmRecord = {
      tokenCode: "XLM",
      issuer: "",
      isNative: true,
      domain: "",
      tokenType: undefined,
      hasTrustline: true,
    } as any;
    const { getByText, queryByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={xlmRecord}
        priceInfo={{}}
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    expect(getByText("Stellar Network")).toBeTruthy();
    expect(getByText("stellar.org")).toBeTruthy();
    // The Type row was dropped — confirm it's no longer rendered.
    expect(queryByText(/Stellar Classic/)).toBeNull();
    expect(queryByText(/Stellar Native/)).toBeNull();
  });

  it("hides the delta line when price exists but 24h % is missing", () => {
    const { queryByText, getByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{ currentPrice: new BigNumber("0.05") }}
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    expect(getByText(/0\.05/)).toBeTruthy();
    expect(queryByText(/%/)).toBeNull();
  });

  it("does not render the price when currentPrice is missing", () => {
    const { queryByText } = renderWithProviders(
      <TrendingTokenDetailBottomSheet
        record={mockRecord}
        priceInfo={{ percentagePriceChange24h: new BigNumber("3.4") }}
        onSwapTo={noop}
        onCancel={noop}
      />,
    );
    // No $0.05 placeholder — currentPrice is undefined, no Display block.
    expect(queryByText(/\$0\.05/)).toBeNull();
  });

  describe("Swap-to CTA", () => {
    it("fires onSwapTo when the trusted-state CTA is pressed", () => {
      const onSwapTo = jest.fn();
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          onSwapTo={onSwapTo}
          onCancel={noop}
        />,
      );
      fireEvent.press(getByText(/Swap to AQUA/i));
      expect(onSwapTo).toHaveBeenCalledTimes(1);
    });

    it("does not render the Cancel + Swap-to-anyway pair when the record is unflagged", () => {
      const { queryByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(queryByTestId("trending-detail-cancel-button")).toBeNull();
      expect(queryByTestId("trending-detail-swap-to-anyway-button")).toBeNull();
    });
  });

  describe("Flagged state — Cancel + Swap-to-anyway", () => {
    it("renders Cancel + Swap-to-anyway when securityLevel is MALICIOUS", () => {
      const { getByTestId, getByText, queryByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(getByTestId("trending-detail-cancel-button")).toBeTruthy();
      expect(getByTestId("trending-detail-swap-to-anyway-button")).toBeTruthy();
      expect(getByText(/Swap to AQUA anyway/i)).toBeTruthy();
      // The single trusted-state CTA is hidden — only the anyway label exists
      // (not the trusted "Swap to AQUA" without "anyway").
      expect(queryByText(/^Swap to AQUA$/)).toBeNull();
    });

    it("renders Cancel + Swap-to-anyway when securityLevel is SUSPICIOUS", () => {
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.SUSPICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(getByTestId("trending-detail-cancel-button")).toBeTruthy();
      expect(getByTestId("trending-detail-swap-to-anyway-button")).toBeTruthy();
    });

    it("keeps the single trusted CTA when securityLevel is UNABLE_TO_SCAN", () => {
      const { queryByTestId, getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{
            ...mockRecord,
            securityLevel: SecurityLevel.UNABLE_TO_SCAN,
          }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      // Unable-to-scan triggers the banner but NOT the cancel/anyway pattern
      // (mirrors SwapReviewFooter's isTrusted logic).
      expect(queryByTestId("trending-detail-cancel-button")).toBeNull();
      expect(queryByTestId("trending-detail-swap-to-anyway-button")).toBeNull();
      expect(getByText(/^Swap to AQUA$/)).toBeTruthy();
    });

    it("fires onCancel when the Cancel button is pressed", () => {
      const onCancel = jest.fn();
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={onCancel}
        />,
      );
      fireEvent.press(getByTestId("trending-detail-cancel-button"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("fires onSwapTo when the Swap-to-anyway TextButton is pressed", () => {
      const onSwapTo = jest.fn();
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          onSwapTo={onSwapTo}
          onCancel={noop}
        />,
      );
      fireEvent.press(getByTestId("trending-detail-swap-to-anyway-button"));
      expect(onSwapTo).toHaveBeenCalledTimes(1);
    });
  });

  describe("Blockaid banner", () => {
    it("renders a red banner with malicious copy when securityLevel is MALICIOUS", () => {
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(getByText(/flagged as malicious/i)).toBeTruthy();
    });

    it("renders an amber banner with suspicious copy when securityLevel is SUSPICIOUS", () => {
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.SUSPICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(getByText(/flagged as suspicious/i)).toBeTruthy();
    });

    it("renders a proceed-with-caution banner when securityLevel is UNABLE_TO_SCAN", () => {
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{
            ...mockRecord,
            securityLevel: SecurityLevel.UNABLE_TO_SCAN,
          }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(getByText(/proceed with caution/i)).toBeTruthy();
    });

    it("does not render the banner when securityLevel is SAFE", () => {
      const { queryByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.SAFE }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(queryByText(/flagged as malicious/i)).toBeNull();
      expect(queryByText(/flagged as suspicious/i)).toBeNull();
      expect(queryByText(/proceed with caution/i)).toBeNull();
    });

    it("never renders a banner for native XLM even when unscannable", () => {
      // Native XLM has no issuer, so the bulk scan can't reach it and the
      // level falls through to UNABLE_TO_SCAN — but native is trusted by
      // definition, so no banner (matches useReviewSecuritySummary).
      const xlmRecord = {
        tokenCode: "XLM",
        issuer: "",
        isNative: true,
        domain: "",
        tokenType: undefined,
        hasTrustline: true,
        securityLevel: SecurityLevel.UNABLE_TO_SCAN,
      } as any;
      const { queryByText, getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={xlmRecord}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(queryByText(/proceed with caution/i)).toBeNull();
      expect(queryByText(/flagged as/i)).toBeNull();
      // Trusted single CTA still renders.
      expect(getByText(/^Swap to XLM$/)).toBeTruthy();
    });

    it("fires onSecurityWarningPress when the banner is tapped", () => {
      const onSecurityWarningPress = jest.fn();
      const { getByText } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={{ ...mockRecord, securityLevel: SecurityLevel.MALICIOUS }}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
          onSecurityWarningPress={onSecurityWarningPress}
        />,
      );
      fireEvent.press(getByText(/flagged as malicious/i));
      expect(onSecurityWarningPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("copy issuer key", () => {
    beforeEach(() => {
      mockCopyToClipboard.mockClear();
    });

    it("copies the FULL SAC C-address (not the truncated label) when the issuer row is tapped", () => {
      const { getByTestId } = renderWithProviders(
        <TrendingTokenDetailBottomSheet
          record={mockRecord}
          priceInfo={{}}
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      fireEvent.press(getByTestId("trending-detail-copy-issuer"));
      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      const [copiedValue] = mockCopyToClipboard.mock.calls[0];
      // SAC C-addresses are 56-char base32 starting with 'C'. Loosen the
      // check so we don't bake the network passphrase / encoding details
      // into this assertion — the key invariant is "not the G-address and
      // not the truncated label".
      expect(copiedValue.startsWith("C")).toBe(true);
      expect(copiedValue).not.toBe(mockRecord.issuer);
      expect(copiedValue).not.toMatch(/\.\.\./);
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
          onSwapTo={noop}
          onCancel={noop}
        />,
      );
      expect(queryByTestId("trending-detail-copy-issuer")).toBeNull();
    });
  });
});
