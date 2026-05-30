import { fireEvent, render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import React from "react";

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: jest.fn(),
  }),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: jest.fn(),
  }),
}));

jest.mock("components/ContextMenuButton", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("helpers/soroban", () => ({
  getNativeContractDetails: () => ({ contract: "CNATIVE..." }),
  formatTokenForDisplay: (amount: string) => amount,
}));

const mockHeldBalance = {
  id: "USDC:GA5Z...",
  tokenCode: "USDC",
  token: {
    code: "USDC",
    issuer: { key: "GA5Z..." },
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  },
  total: new BigNumber("100"),
  fiatTotal: new BigNumber("100"),
  fiatCode: "USD",
  percentagePriceChange24h: new BigNumber("2.5"),
  decimals: 7,
} as any;

const mockSearchRecord = {
  tokenCode: "AQUA",
  issuer: "GBN...",
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  hasTrustline: false,
  domain: "aqua.network",
} as any;

describe("SwapTokenRow", () => {
  it("renders fiat total + 24h% for held variant", () => {
    const { getByText } = render(
      <SwapTokenRow
        variant="held"
        balance={mockHeldBalance}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("USDC")).toBeTruthy();
    // The fiat formatting may include $ and comma — match loosely
    expect(getByText(/100/)).toBeTruthy();
    expect(getByText(/2\.5/)).toBeTruthy();
  });

  it("renders ellipsis (context menu) for non-held variant", () => {
    const { getByText } = render(
      <SwapTokenRow
        variant="non-held"
        record={mockSearchRecord}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("AQUA")).toBeTruthy();
    expect(getByText("aqua.network")).toBeTruthy();
  });

  it("renders price + 24h% for trending variant", () => {
    const { getByText } = render(
      <SwapTokenRow
        variant="trending"
        record={mockSearchRecord}
        priceInfo={{
          currentPrice: new BigNumber("0.05"),
          percentagePriceChange24h: new BigNumber("-1.2"),
        }}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("AQUA")).toBeTruthy();
    expect(getByText(/0\.05/)).toBeTruthy();
    expect(getByText(/-1\.2/)).toBeTruthy();
  });

  it("renders '--' for 24h% when percentagePriceChange24h is undefined (same as Home balances)", () => {
    const { getByText } = render(
      <SwapTokenRow
        variant="trending"
        record={mockSearchRecord}
        priceInfo={{ currentPrice: new BigNumber("0.05") }}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    expect(getByText(/0\.05/)).toBeTruthy();
    expect(getByText("--")).toBeTruthy();
  });

  it("calls onPress when the row is tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <SwapTokenRow
        variant="trending"
        record={mockSearchRecord}
        priceInfo={{}}
        network={NETWORKS.PUBLIC}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText("AQUA"));
    expect(onPress).toHaveBeenCalled();
  });

  it("re-renders when priceInfo changes from BigNumber(0) to undefined (memo comparator regression)", () => {
    const onPress = jest.fn();
    const { rerender, queryByText, getByText, getAllByText } = render(
      <SwapTokenRow
        variant="trending"
        record={mockSearchRecord}
        priceInfo={{ currentPrice: new BigNumber("0") }}
        network={NETWORKS.PUBLIC}
        onPress={onPress}
      />,
    );

    // Initially: price is $0.00 — rendered via formatFiatAmount(BigNumber(0))
    expect(getByText(/\$0/)).toBeTruthy();

    rerender(
      <SwapTokenRow
        variant="trending"
        record={mockSearchRecord}
        priceInfo={{}}
        network={NETWORKS.PUBLIC}
        onPress={onPress}
      />,
    );

    // After re-render: currentPrice is undefined → component should render "--"
    // and the "$0" text should no longer be present. Both the price and the
    // 24h% slots render "--" when their respective values are missing.
    expect(queryByText(/\$0/)).toBeNull();
    expect(getAllByText("--").length).toBeGreaterThanOrEqual(1);
  });
});
