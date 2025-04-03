import { HomeScreen } from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-context-menu-view", () => {
  const ContextMenu = ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: (e: { nativeEvent: { index: number } }) => void;
  }) => {
    const handlePress = () => {
      if (onPress) {
        onPress({ nativeEvent: { index: 0 } });
      }
    };

    return (
      <button onClick={handlePress} data-testid="context-menu" type="button">
        {children}
      </button>
    );
  };

  return {
    __esModule: true,
    default: ContextMenu,
  };
});

// Mock the stores
jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: false,
      error: null,
      fetchAccountBalances: jest
        .fn()
        .mockImplementation(() => Promise.resolve()),
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(() => ({
    prices: {},
    isLoading: false,
    error: null,
    lastUpdated: null,
    fetchPricesForBalances: jest.fn(),
  })),
}));

describe("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText("Tokens")).toBeTruthy();
  });
});
