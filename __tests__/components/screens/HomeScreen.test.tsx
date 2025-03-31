import { HomeScreen } from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock React Navigation hooks
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    // Execute the callback once to simulate focus
    callback();
    return null;
  }),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
  })),
}));

// Mock the stores
jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn(() => ({
    balances: {},
    pricedBalances: {},
    isLoading: false,
    error: null,
    fetchAccountBalances: jest.fn(),
  })),
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

describe.skip("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText("Tokens")).toBeTruthy();
  });
});
