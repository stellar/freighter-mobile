import { render, screen } from "@testing-library/react-native";
import { TokensCollectiblesTabs } from "components/TokensCollectiblesTabs";
import { NETWORKS } from "config/constants";
import React from "react";
import { View as mockView } from "react-native";

const MockView = mockView;

jest.mock("components/BalancesList", () => ({
  BalancesList: () => <MockView testID="balances-list" />,
}));

jest.mock("components/CollectiblesGrid", () => ({
  CollectiblesGrid: () => <MockView testID="collectibles-grid" />,
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) =>
      ({
        "balancesList.title": "Tokens",
        "collectiblesGrid.title": "Collectibles",
      })[key] || key,
  }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      text: {
        primary: "#000",
        secondary: "#111",
      },
    },
  }),
}));

const renderTabs = (props = {}) =>
  render(
    <TokensCollectiblesTabs
      publicKey="G..."
      network={NETWORKS.TESTNET}
      {...props}
    />,
  );

describe("TokensCollectiblesTabs", () => {
  it("renders the Tokens and Collectibles tab headers", () => {
    renderTabs();

    expect(screen.getByTestId("tab-tokens")).toBeTruthy();
    expect(screen.getByTestId("tab-collectibles")).toBeTruthy();
  });

  it("does not render a settings menu button", () => {
    const { queryByTestId } = renderTabs();

    // The Sliders settings context menu has been removed; only the plain tab
    // headers remain, with no trailing menu trigger.
    expect(queryByTestId("tab-tokens")).toBeTruthy();
    expect(queryByTestId("tab-collectibles")).toBeTruthy();
    expect(
      screen.queryByTestId("tokens-collectibles-settings-menu"),
    ).toBeNull();
  });
});
