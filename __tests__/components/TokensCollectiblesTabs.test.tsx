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
});
