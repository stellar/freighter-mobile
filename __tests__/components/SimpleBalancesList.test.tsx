import { BigNumber } from "bignumber.js";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(),
}));

describe("SimpleBalancesList", () => {
  const mockBalanceItems = [
    {
      id: "XLM",
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
    } as PricedBalance,
    {
      id: "USDC",
      token: {
        code: "USDC",
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        type: "credit_alphanum4",
      },
      total: new BigNumber("200"),
      available: new BigNumber("200"),
      limit: new BigNumber("1000"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
      tokenCode: "USDC",
      displayName: "USDC",
      imageUrl: "",
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("-0.01"),
      fiatCode: "USD",
      fiatTotal: new BigNumber("200"),
    } as PricedBalance,
  ];

  const testPublicKey =
    "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";

  beforeEach(() => {
    jest.clearAllMocks();
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: mockBalanceItems,
    });
  });

  it("should render nothing when there are no balances", () => {
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: [],
    });

    const { queryByText } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
        handleRemoveToken={() => {}}
      />,
    );

    expect(queryByText("XLM")).toBeNull();
    expect(queryByText("USDC")).toBeNull();
  });

  it("should render all balance items", () => {
    const { getByText } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
        handleRemoveToken={() => {}}
      />,
    );

    expect(getByText("XLM")).toBeTruthy();
    expect(getByText("USDC")).toBeTruthy();
  });

  it("should call useBalancesList with correct parameters", () => {
    renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
        handleRemoveToken={() => {}}
      />,
    );

    expect(useBalancesList).toHaveBeenCalledWith({
      publicKey: testPublicKey,
      network: NETWORKS.TESTNET,
      shouldPoll: false,
    });
  });

  it("should render ScrollView with correct props", () => {
    const { getByTestId } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
        handleRemoveToken={() => {}}
      />,
    );

    const scrollView = getByTestId("simple-balances-list");
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
    expect(scrollView.props.alwaysBounceVertical).toBe(false);
  });
});
