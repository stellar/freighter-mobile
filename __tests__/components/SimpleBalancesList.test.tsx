import { fireEvent, renderHook } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BottomSheetProps } from "components/BottomSheet";
import { ManageTokenRightContentProps } from "components/ManageTokenRightContent";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { TouchableOpacity, View } from "react-native";

const MockTouchable = TouchableOpacity;
const MockText = Text;
const MockView = View;

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(),
}));

jest.mock(
  "components/ManageTokenRightContent",
  () =>
    ({ token, handleRemoveToken }: ManageTokenRightContentProps) => (
      <MockTouchable
        testID={`remove-token-button-${token.id}`}
        onPress={() => {
          handleRemoveToken();
        }}
      >
        <MockText>Remove</MockText>
      </MockTouchable>
    ),
);

jest.mock(
  "components/BottomSheet",
  () =>
    ({ customContent }: BottomSheetProps) => (
      <MockView>{customContent}</MockView>
    ),
);

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
      />,
    );

    expect(useBalancesList).toHaveBeenCalledWith({
      publicKey: testPublicKey,
      network: NETWORKS.TESTNET,
    });
  });

  it("should render ScrollView with correct props", () => {
    const { getByTestId } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
      />,
    );

    const scrollView = getByTestId("simple-balances-list");
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
    expect(scrollView.props.alwaysBounceVertical).toBe(false);
  });

  it("should render \"cannot remove XLM\" BottomSheet for XLM when removing is attempted", () => {
    const { result } = renderHook(() => useAppTranslation());
    const { getByTestId } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
      />,
    );

    fireEvent.press(
      getByTestId(`remove-token-button-${mockBalanceItems[0].id}`),
    );
    expect(getByTestId("bottom-sheet-content-title")).toHaveTextContent(
      result.current.t("manageTokensScreen.cantRemoveXlm.title"),
    );
  });

  it("should render \"token still has a balance\" BottomSheet for tokens with balances when removing is attempted", () => {
    const { result } = renderHook(() => useAppTranslation());
    const { getByTestId } = renderWithProviders(
      <SimpleBalancesList
        publicKey={testPublicKey}
        network={NETWORKS.TESTNET}
      />,
    );

    fireEvent.press(
      getByTestId(`remove-token-button-${mockBalanceItems[1].id}`),
    );
    expect(getByTestId("bottom-sheet-content-title")).toHaveTextContent(
      result.current.t("manageTokensScreen.cantRemoveBalance.title"),
    );
  });
});
