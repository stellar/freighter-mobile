import { fireEvent, render, screen } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { classNameOf, hostParentOf } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

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
    const { getByText, getAllByText } = render(
      <SwapTokenRow
        variant="held"
        balance={mockHeldBalance}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("USDC")).toBeTruthy();
    // Two "100" matches expected now: the fiat total in the right slot AND
    // the raw token amount in the left-side subtitle (added to match Home).
    expect(getAllByText(/100/).length).toBeGreaterThanOrEqual(2);
    expect(getByText(/2\.5/)).toBeTruthy();
  });

  it("renders raw token amount as the left-side subtitle for held variant (matches Home BalanceRow)", () => {
    const { getByText } = render(
      <SwapTokenRow
        variant="held"
        balance={mockHeldBalance}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    // formatBalanceAmount(balance, "USDC") returns "<n> USDC". Match a digit
    // followed by " USDC" so we don't collide with the bare "USDC" code text.
    expect(getByText(/\d\s+USDC$/)).toBeTruthy();
  });

  it("omits the raw-amount subtitle when balance.total is missing (defensive)", () => {
    const { queryByText } = render(
      <SwapTokenRow
        variant="held"
        balance={
          {
            id: "USDC:GA5Z...",
            tokenCode: "USDC",
            token: mockHeldBalance.token,
          } as any
        }
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
      />,
    );
    // No "X USDC" subtitle; only the bare code text node.
    expect(queryByText(/^\d+.*USDC$/)).toBeNull();
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

  describe("non-held / trending subtitle fallback chain (domain → name → tokenCode)", () => {
    it("falls back to record.name when domain is empty", () => {
      const { getByText, queryByText } = render(
        <SwapTokenRow
          variant="non-held"
          record={{ ...mockSearchRecord, domain: "", name: "Aquarius" }}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
        />,
      );
      expect(getByText("Aquarius")).toBeTruthy();
      // The empty-string domain should NOT have rendered.
      expect(queryByText(/aqua\.network/)).toBeNull();
    });

    it("falls back to tokenCode when both domain and name are missing", () => {
      const { getAllByText, queryByText } = render(
        <SwapTokenRow
          variant="non-held"
          record={{ ...mockSearchRecord, domain: "", name: undefined }}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
        />,
      );
      // tokenCode appears twice: top-line + fallback subtitle.
      expect(getAllByText("AQUA").length).toBeGreaterThanOrEqual(2);
      expect(queryByText(/aqua\.network/)).toBeNull();
    });

    it("prefers domain over name when both are present (trending variant)", () => {
      const { getByText, queryByText } = render(
        <SwapTokenRow
          variant="trending"
          record={{
            ...mockSearchRecord,
            domain: "aqua.network",
            name: "Aquarius",
          }}
          priceInfo={{ currentPrice: new BigNumber("0.05") }}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
        />,
      );
      expect(getByText("aqua.network")).toBeTruthy();
      expect(queryByText("Aquarius")).toBeNull();
    });

    it("special-cases native XLM with 'Stellar Lumens' regardless of domain/name", () => {
      const { getByText, queryByText } = render(
        <SwapTokenRow
          variant="trending"
          record={
            {
              tokenCode: "XLM",
              issuer: "",
              isNative: true,
              // Even if stellar.expert returned a domain or a name, the XLM
              // row should display the canonical "Stellar Lumens" subtitle.
              domain: "stellar.org",
              name: "Some other name",
              tokenType: undefined,
              hasTrustline: true,
            } as any
          }
          priceInfo={{ currentPrice: new BigNumber("0.4") }}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
        />,
      );
      expect(getByText("Stellar Lumens")).toBeTruthy();
      expect(queryByText("stellar.org")).toBeNull();
      expect(queryByText("Some other name")).toBeNull();
    });
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

  it("exposes the forwarded testID on the row (used by e2e to tap a specific token)", () => {
    const { getByTestId } = render(
      <SwapTokenRow
        variant="held"
        balance={mockHeldBalance}
        network={NETWORKS.PUBLIC}
        onPress={jest.fn()}
        testID="token-option-USDC"
      />,
    );
    expect(getByTestId("token-option-USDC")).toBeTruthy();
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

  describe("rowStyle", () => {
    const styleOf = (node?: ReactTestInstance | null) =>
      StyleSheet.flatten(node?.props.style);

    const renderHeldRow = (rowStyle?: "default" | "shared") =>
      render(
        <SwapTokenRow
          variant="held"
          rowStyle={rowStyle}
          balance={mockHeldBalance}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
          testID="token-option-USDC"
        />,
      );

    it("shared held row uses the shared type", () => {
      renderHeldRow("shared");

      // Text/MD/600 for the code and the fiat value; the "<n> USDC" amount
      // takes Figma's 20pt line height instead of the app's 22.
      expect(styleOf(screen.getByText("USDC"))).toMatchObject({
        fontSize: 16,
        fontWeight: "600",
      });
      expect(styleOf(screen.getByText(/\d\s+USDC$/))).toMatchObject({
        lineHeight: 20,
      });
      expect(styleOf(screen.getByText("$100.00"))).toMatchObject({
        fontWeight: "600",
      });
    });

    it("shared held row sets the amount 2pt under the code", () => {
      renderHeldRow("shared");

      expect(styleOf(screen.getByText(/\d\s+USDC$/))).toMatchObject({
        marginTop: 2,
      });
    });

    it("shared held row pads 12pt top and bottom and drops the 24pt bottom margin", () => {
      renderHeldRow("shared");

      const row = screen.getByTestId("token-option-USDC");
      // The padding is a style so it scales with the screen like the token
      // rows' (pxValue is the identity in tests); NativeWind doesn't apply
      // classes in tests, so the margin is read off the class names.
      expect(styleOf(row)).toMatchObject({ paddingVertical: 12 });
      expect(classNameOf(row)).toContain("flex-row");
      expect(classNameOf(row)).not.toContain("mb-6");
    });

    it("shared held row scales the 16pt gap between the icon and the text", () => {
      renderHeldRow("shared");

      const textColumn = hostParentOf(screen.getByText("USDC"));
      // A style, not the 14pt `ml-4`, so the text starts where the divider
      // under the row does at every screen width.
      expect(styleOf(textColumn)).toMatchObject({ marginLeft: 16 });
      expect(textColumn?.props.className).not.toContain("ml-4");
    });

    it("shared held row scales the 16pt gap before the right column", () => {
      renderHeldRow("shared");

      // The view around the icon and the text column.
      const leftBlock = hostParentOf(hostParentOf(screen.getByText("USDC")));
      // A style, not the 14pt `mr-4`, so the right column sits where Home's
      // rows put it at every screen width.
      expect(styleOf(leftBlock)).toMatchObject({ marginRight: 16 });
      expect(leftBlock?.props.className).not.toContain("mr-4");
    });

    it("shared held row shows the right column Home's rows show", () => {
      renderHeldRow("shared");

      expect(screen.getByTestId("right-section")).toBeTruthy();
    });

    it("default held row is unchanged", () => {
      renderHeldRow("default");

      const row = screen.getByTestId("token-option-USDC");
      expect(classNameOf(row)).toContain("mb-6");
      expect(styleOf(row)).not.toHaveProperty("paddingVertical");
      expect(hostParentOf(screen.getByText("USDC"))?.props.className).toContain(
        "ml-4",
      );
      expect(
        hostParentOf(hostParentOf(screen.getByText("USDC")))?.props.className,
      ).toContain("mr-4");
      expect(styleOf(screen.getByText("USDC"))).toMatchObject({
        fontWeight: "500",
      });
      expect(screen.queryByTestId("right-section")).toBeNull();
    });

    it("keeps the default row when rowStyle is left out", () => {
      renderHeldRow();

      expect(classNameOf(screen.getByTestId("token-option-USDC"))).toContain(
        "mb-6",
      );
    });

    it("ignores rowStyle on non-held rows", () => {
      render(
        <SwapTokenRow
          variant="trending"
          rowStyle="shared"
          record={mockSearchRecord}
          priceInfo={{ currentPrice: new BigNumber("0.05") }}
          network={NETWORKS.PUBLIC}
          onPress={jest.fn()}
          testID="token-option-AQUA"
        />,
      );

      expect(classNameOf(screen.getByTestId("token-option-AQUA"))).toContain(
        "mb-6",
      );
      expect(styleOf(screen.getByText("AQUA"))).toMatchObject({
        fontWeight: "500",
      });
    });

    it("re-renders when rowStyle changes (memo comparator regression)", () => {
      const onPress = jest.fn();
      const { rerender } = render(
        <SwapTokenRow
          variant="held"
          balance={mockHeldBalance}
          network={NETWORKS.PUBLIC}
          onPress={onPress}
        />,
      );

      expect(styleOf(screen.getByText("USDC"))).toMatchObject({
        fontWeight: "500",
      });

      // Same balance object and the same onPress, so only rowStyle differs.
      rerender(
        <SwapTokenRow
          variant="held"
          rowStyle="shared"
          balance={mockHeldBalance}
          network={NETWORKS.PUBLIC}
          onPress={onPress}
        />,
      );

      expect(styleOf(screen.getByText("USDC"))).toMatchObject({
        fontWeight: "600",
      });
    });
  });
});
