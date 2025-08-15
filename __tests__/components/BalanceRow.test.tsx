import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalanceRow, DefaultRightContent } from "components/BalanceRow";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import * as balancesHelpers from "helpers/balances";
import React from "react";
import { Text } from "react-native";

// Mock the balances helpers
jest.mock("helpers/balances", () => ({
  isLiquidityPool: jest.fn(),
}));

// Mock formatAmount helpers
jest.mock("helpers/formatAmount", () => ({
  formatTokenAmount: jest.fn((amount) => amount.toString()),
  formatFiatAmount: jest.fn((amount) => `$${amount.toString()}`),
  formatPercentageAmount: jest.fn((amount) => {
    if (!amount) return "—";
    const isNegative = amount.isLessThan(0);
    return `${isNegative ? "-" : "+"}${amount.abs().toString()}%`;
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
  });

  it("should render basic balance information", () => {
    const { getByText } = render(<BalanceRow balance={mockBalance} />);

    expect(getByText("XLM")).toBeTruthy();
    expect(getByText("100.5")).toBeTruthy();
  });

  it("should render default right content with fiat values", () => {
    const { getByText } = render(<BalanceRow balance={mockBalance} />);

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

    it("should use correct color for positive price change", () => {
      const { getByText } = render(
        <DefaultRightContent balance={mockBalance} />,
      );

      const priceChangeElement = getByText("+0.02%");
      expect(priceChangeElement.props.style.color).toBe(
        THEME.colors.status.success,
      );
    });

    it("should use correct color for negative price change", () => {
      const balanceWithNegativeChange = {
        ...mockBalance,
        percentagePriceChange24h: new BigNumber("-0.02"),
      };

      const { getByText } = render(
        <DefaultRightContent balance={balanceWithNegativeChange} />,
      );

      const priceChangeElement = getByText("-0.02%");
      expect(priceChangeElement.props.style.color).toBe(
        THEME.colors.text.secondary,
      );
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
  });
});
