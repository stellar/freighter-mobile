/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable @typescript-eslint/naming-convention */
import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalanceRow, DefaultRightContent } from "components/BalanceRow";
import Icon from "components/sds/Icon";
import { PricedBalance } from "config/types";
import * as balancesHelpers from "helpers/balances";
import React from "react";
import { Text } from "react-native";

import {
  benignTokenScan,
  maliciousTokenScan,
  suspiciousTokenScan,
} from "../../__mocks__/blockaid-response";

// Mock the balances helpers
jest.mock("helpers/balances", () => ({
  isLiquidityPool: jest.fn(),
  hasDecimals: jest.fn(),
  getTokenIdentifier: jest.fn((token) => {
    if (token.type === "native") return "XLM";
    if (token.issuer?.key) return `${token.code}:${token.issuer.key}`;
    return token.code;
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
    jest.mocked(balancesHelpers.isLiquidityPool).mockReturnValue(false);
    jest.mocked(balancesHelpers.hasDecimals).mockReturnValue(false);
  });

  it("should render basic balance information", () => {
    const { getByText } = render(
      <BalanceRow balance={mockBalance} scanResult={benignTokenScan} />,
    );

    expect(getByText("XLM")).toBeTruthy();
    expect(getByText("100.5 XLM")).toBeTruthy();
  });

  it("should format custom token balance with decimals correctly", () => {
    const customTokenBalance = {
      ...mockBalance,
      token: {
        code: "TEST",
        issuer: { key: "C1234567890" },
      },
      total: new BigNumber("10000"), // Raw amount for 4 decimals
      available: new BigNumber("10000"),
      decimals: 4,
      contractId: "C1234567890",
      name: "Test Token",
      symbol: "TEST",
      tokenCode: "TEST",
      displayName: "Test Token",
    } as PricedBalance;

    const { getByText } = render(
      <BalanceRow balance={customTokenBalance} scanResult={benignTokenScan} />,
    );

    expect(getByText("Test Token")).toBeTruthy();
    // formatBalanceAmount should convert 10000 (raw) to 1 (trimmed), then format as 1.00
    expect(getByText("1.00 TEST")).toBeTruthy();
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

  describe("DefaultRightContent", () => {
    it("should render fiat values for regular tokens", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      expect(getByText("$50.25")).toBeTruthy();
      expect(getByText("+0.02%")).toBeTruthy();
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

    it("should use success color for positive price changes at or above threshold", () => {
      const { getByText: getByTextAbove } = render(
        <DefaultRightContent balance={mockBalance} />,
      );
      const priceChangeElementAbove = getByTextAbove("+0.02%");

      expect(priceChangeElementAbove.props.style.color).toBe("#30a46c");

      const balanceAtThreshold = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("0.01"),
      };
      const { getByText: getByTextAt } = render(
        <DefaultRightContent balance={balanceAtThreshold} />,
      );
      const priceChangeElementAt = getByTextAt("+0.01%");

      expect(priceChangeElementAt.props.style.color).toBe("#30a46c");
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

      expect(priceChangeElementNegative.props.style.color).toBe("#a0a0a0");

      const balanceBelowThreshold = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("0.004"),
      };
      const { getByText: getByTextBelow } = render(
        <DefaultRightContent balance={balanceBelowThreshold} />,
      );
      const priceChangeElementBelow = getByTextBelow("+0.00%");

      expect(priceChangeElementBelow.props.style.color).toBe("#a0a0a0");
    });

    it("should adjust width for liquidity pool tokens", () => {
      jest.mocked(balancesHelpers.isLiquidityPool).mockReturnValue(true);
      const liquidityPoolBalance = {
        ...mockBalance,
        liquidityPoolId: "pool-id",
      };

      const { getByTestId } = render(
        <DefaultRightContent balance={liquidityPoolBalance} />,
      );

      // Check if the RightSection has the correct width
      const rightSection = getByTestId("right-section");
      expect(rightSection.props.width).toBe(20);
    });

    it("should show alert icon for malicious tokens", () => {
      const { UNSAFE_getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={maliciousTokenScan} />,
      );

      const icon = UNSAFE_getByType(Icon.AlertCircle);
      expect(icon).toBeTruthy();
      expect(icon.props.themeColor).toBe("red");
    });

    it("should show alert icon for suspicious tokens", () => {
      const { UNSAFE_getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={suspiciousTokenScan} />,
      );

      const icon = UNSAFE_getByType(Icon.AlertCircle);
      expect(icon).toBeTruthy();
      expect(icon.props.themeColor).toBe("amber");
    });

    it("should not show alert icon for benign tokens", () => {
      const { UNSAFE_getByType } = render(
        <BalanceRow balance={mockBalance} scanResult={benignTokenScan} />,
      );

      try {
        UNSAFE_getByType(Icon.AlertCircle);
      } catch (error: unknown) {
        expect((error as Error).message).toBe(
          'No instances found with node type: "Unknown"',
        );
      }
    });
  });
});
