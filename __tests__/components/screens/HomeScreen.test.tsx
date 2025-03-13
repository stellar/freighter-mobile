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

// Mock the balance fetcher
jest.mock("ducks/balances", () => ({
  useBalancesFetcher: jest.fn(() => ({
    fetchAccountBalances: jest.fn(),
  })),
  useBalances: jest.fn(() => ({
    balances: {},
    isLoading: false,
    error: null,
  })),
}));

describe("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText("Tokens")).toBeTruthy();
  });
});
