/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import SwapScreen from "components/screens/SwapScreen";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { TouchableOpacity, View } from "react-native";

import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";

const TEST_SYMBOL = "SRC";
const TEST_KEY = "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH";
const TEST_TOKEN_ID = `${TEST_SYMBOL}:${TEST_KEY}`;
const DST_TOKEN_ID = `DST:${TEST_KEY}`;

const MockView = View;
const MockTouchable = TouchableOpacity;
mockGestureHandler();

const mockSetSourceToken = jest.fn();
const mockSetDestinationToken = jest.fn();

jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(() => ({
    setSourceToken: mockSetSourceToken,
    setDestinationToken: mockSetDestinationToken,
    sourceTokenId: TEST_TOKEN_ID,
    destinationToken: {
      id: DST_TOKEN_ID,
      tokenCode: "DST",
      issuer: TEST_KEY,
      decimals: 7,
      // Use string literal to avoid jest.mock out-of-scope variable restriction
      tokenType: "credit_alphanum4",
      isNew: false,
    },
  })),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: [
      {
        id: TEST_TOKEN_ID,
        token: {
          // Use string literal to avoid jest.mock out-of-scope variable restriction
          type: "credit_alphanum4",
          code: TEST_SYMBOL,
          issuer: { key: TEST_KEY },
        },
        decimals: 7,
      },
    ],
  })),
}));

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: {
    publicKey: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  },
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: "testnet" })),
}));

jest.mock("components/screens/SwapScreen/components", () => ({
  TokenSelectionContent: ({
    onTokenPress,
  }: {
    onTokenPress: (id: string, symbol: string) => void;
  }) => (
    <MockView>
      <MockTouchable
        testID="token-button"
        onPress={() => onTokenPress(TEST_TOKEN_ID, TEST_SYMBOL)}
      />
    </MockView>
  ),
}));

const mockGoBack = jest.fn();

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const makeNavigation = () =>
  ({
    goBack: mockGoBack,
  }) as unknown as SwapScreenProps["navigation"];

const makeRoute = (selectionType: SWAP_SELECTION_TYPES) =>
  ({
    key: "swap-screen",
    name: SWAP_ROUTES.SWAP_SCREEN,
    params: { selectionType },
  }) as unknown as SwapScreenProps["route"];

describe("SwapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets source token when selection type is source", () => {
    const { getByTestId } = renderWithProviders(
      <SwapScreen
        navigation={makeNavigation()}
        route={makeRoute(SWAP_SELECTION_TYPES.SOURCE)}
      />,
    );

    fireEvent.press(getByTestId("token-button"));

    expect(mockSetSourceToken).toHaveBeenCalledWith(TEST_TOKEN_ID, TEST_SYMBOL);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("sets destination token when selection type is destination", () => {
    const { getByTestId } = renderWithProviders(
      <SwapScreen
        navigation={makeNavigation()}
        route={makeRoute(SWAP_SELECTION_TYPES.DESTINATION)}
      />,
    );

    fireEvent.press(getByTestId("token-button"));

    // The component resolves the balance from balanceItems and projects it to a
    // DestinationTokenDescriptor (descriptorFromBalance). isNew is always false
    // for held balances.
    expect(mockSetDestinationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TEST_TOKEN_ID,
        tokenCode: TEST_SYMBOL,
        isNew: false,
      }),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });
});
