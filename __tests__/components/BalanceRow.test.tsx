/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable @typescript-eslint/naming-convention */
import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalanceRow, DefaultRightContent } from "components/BalanceRow";
import Icon from "components/sds/Icon";
import { PricedBalance } from "config/types";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

import {
  benignTokenScan,
  maliciousTokenScan,
  suspiciousTokenScan,
} from "../../__mocks__/blockaid-response";

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useColors hook
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      status: {
        success: "#30a46c",
      },
      green: {
        10: "#299764",
      },
      border: {
        primary: "#e2e2e2",
      },
      text: {
        secondary: "#a0a0a0",
      },
      amber: {
        9: "amber",
      },
      red: {
        9: "red",
      },
    },
  }),
}));

// Use actual implementations for helpers
jest.mock("helpers/balances", () => jest.requireActual("helpers/balances"));
jest.mock("helpers/soroban", () => jest.requireActual("helpers/soroban"));
jest.mock("helpers/formatAmount", () =>
  jest.requireActual("helpers/formatAmount"),
);

describe("BalanceRow", () => {
  const mockBalance = {
    token: {
      code: "XLM",
      type: "native",
    },
    total: new BigNumber("100.5"),
    available: new BigNumber("100.5"),
    minimumBalance: new BigNumber("1"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    tokenCode: "XLM",
    displayName: "XLM",
    imageUrl: "",
    currentPrice: new BigNumber("0.5"),
    percentagePriceChange24h: new BigNumber("0.02"),
    fiatCode: "USD",
    fiatTotal: new BigNumber("50.25"),
  } as PricedBalance;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render basic balance information", () => {
    const { getByText } = render(
      <BalanceRow balance={mockBalance} scanResult={benignTokenScan} />,
    );

    expect(getByText("XLM")).toBeTruthy();
    expect(getByText("100.50 XLM")).toBeTruthy();
  });

  it("should render default right content with fiat values", () => {
    const { getByText } = render(
      <BalanceRow balance={mockBalance} scanResult={benignTokenScan} />,
    );

    expect(getByText("$50.25")).toBeTruthy();
    expect(getByText("+0.02%")).toBeTruthy();
  });

  it("should render custom right content when provided", () => {
    const customContent = "Custom Right Content";
    const { getByText, queryByText } = render(
      <BalanceRow
        balance={mockBalance}
        rightContent={<Text>{customContent}</Text>}
        rightSectionWidth={100}
        scanResult={benignTokenScan}
      />,
    );

    expect(getByText(customContent)).toBeTruthy();
    expect(queryByText("$50.25")).toBeNull();
  });

  describe("row styling", () => {
    // The row's own box: the nearest native view around the right section,
    // past the styled-components wrappers.
    const rowContainerOf = (rightSection: ReactTestInstance) => {
      let node = rightSection.parent;
      while (node && typeof node.type !== "string") node = node.parent;
      return node;
    };

    it("shows the name in Text/MD/600", () => {
      const { getByText } = render(<BalanceRow balance={mockBalance} />);

      expect(StyleSheet.flatten(getByText("XLM").props.style)).toMatchObject({
        fontSize: 16,
        fontWeight: "600",
      });
    });

    it("shows the amount in Text/SM/500 at a 20pt line height", () => {
      const { getByText } = render(<BalanceRow balance={mockBalance} />);

      expect(
        StyleSheet.flatten(getByText("100.50 XLM").props.style),
      ).toMatchObject({ fontSize: 14, fontWeight: "500", lineHeight: 20 });
    });

    it("sets the amount 2pt under the name", () => {
      const { getByText } = render(<BalanceRow balance={mockBalance} />);

      expect(
        StyleSheet.flatten(getByText("100.50 XLM").props.style),
      ).toMatchObject({ marginTop: 2 });
    });

    it("pads the row 12pt top and bottom with no bottom margin", () => {
      const { getByTestId } = render(<BalanceRow balance={mockBalance} />);

      const row = StyleSheet.flatten(
        rowContainerOf(getByTestId("right-section"))?.props.style,
      );

      expect(row).toMatchObject({
        flexDirection: "row",
        paddingTop: 12,
        paddingBottom: 12,
      });
      expect(row).not.toHaveProperty("height");
      expect(row).not.toHaveProperty("marginBottom");
    });
  });

  describe("DefaultRightContent", () => {
    it("should render fiat values for regular tokens", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      expect(getByText("$50.25")).toBeTruthy();
      expect(getByText("+0.02%")).toBeTruthy();
    });

    it("shows the fiat value in Text/MD/600", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      expect(StyleSheet.flatten(getByText("$50.25").props.style)).toMatchObject(
        { fontSize: 16, fontWeight: "600" },
      );
    });

    it("shows the price change in Text/SM/500 at a 20pt line height", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      expect(StyleSheet.flatten(getByText("+0.02%").props.style)).toMatchObject(
        { fontSize: 14, fontWeight: "500", lineHeight: 20 },
      );
    });

    it("sets the price change 2pt under the fiat value", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      expect(StyleSheet.flatten(getByText("+0.02%").props.style)).toMatchObject(
        { marginTop: 2 },
      );
    });

    it("should render placeholder when no fiat values available", () => {
      const balanceWithoutFiat = {
        ...mockBalance,
        fiatTotal: undefined,
        percentagePriceChange24h: undefined,
      };

      const { getByText } = render(
        <DefaultRightContent balance={balanceWithoutFiat} />,
      );

      expect(getByText("--")).toBeTruthy();
    });

    it("should use green 10 for positive price changes at or above threshold", () => {
      const { getByText: getByTextAbove } = render(
        <DefaultRightContent balance={mockBalance} />,
      );
      const priceChangeElementAbove = getByTextAbove("+0.02%");

      expect(
        StyleSheet.flatten(priceChangeElementAbove.props.style),
      ).toMatchObject({ color: "#299764" });

      const balanceAtThreshold = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("0.01"),
      };
      const { getByText: getByTextAt } = render(
        <DefaultRightContent balance={balanceAtThreshold} />,
      );
      const priceChangeElementAt = getByTextAt("+0.01%");

      expect(
        StyleSheet.flatten(priceChangeElementAt.props.style),
      ).toMatchObject({ color: "#299764" });
    });

    it("should use secondary color for negative price changes and positive changes below threshold", () => {
      const balanceWithNegativeChange = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("-0.02"),
      };
      const { getByText: getByTextNegative } = render(
        <DefaultRightContent balance={balanceWithNegativeChange} />,
      );
      const priceChangeElementNegative = getByTextNegative("-0.02%");

      expect(
        StyleSheet.flatten(priceChangeElementNegative.props.style),
      ).toMatchObject({ color: "#a0a0a0" });

      const balanceBelowThreshold = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("0.004"),
      };
      const { getByText: getByTextBelow } = render(
        <DefaultRightContent balance={balanceBelowThreshold} />,
      );
      const priceChangeElementBelow = getByTextBelow("+0.00%");

      expect(
        StyleSheet.flatten(priceChangeElementBelow.props.style),
      ).toMatchObject({ color: "#a0a0a0" });
    });

    it("should adjust width for liquidity pool tokens", () => {
      const liquidityPoolBalance = {
        ...mockBalance,
        liquidityPoolId: "pool-id",
        reserves: [
          { asset: "native", amount: "100" },
          {
            asset:
              "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            amount: "200",
          },
        ],
      } as PricedBalance;

      const { getByTestId } = render(
        <DefaultRightContent balance={liquidityPoolBalance} />,
      );

      // Check if the RightSection has the correct width
      const rightSection = getByTestId("right-section");
      expect(rightSection.props.width).toBe(20);
    });

    it("should show alert icon for malicious tokens", () => {
      const { UNSAFE_getByType: getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={maliciousTokenScan} />,
      );

      const icon = getByType(Icon.AlertCircle);
      expect(icon).toBeTruthy();
      expect(icon.props.themeColor).toBe("red");
    });

    it("should show alert icon for suspicious tokens", () => {
      const { UNSAFE_getByType: getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={suspiciousTokenScan} />,
      );

      const icon = getByType(Icon.AlertCircle);
      expect(icon).toBeTruthy();
      expect(icon.props.themeColor).toBe("amber");
    });

    it("should not show alert icon for benign tokens", () => {
      const { UNSAFE_getByType: getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={benignTokenScan} />,
      );

      try {
        getByType(Icon.AlertCircle);
      } catch (error: unknown) {
        expect((error as Error).message).toBe(
          'No instances found with node type: "Unknown"',
        );
      }
    });
  });
});
