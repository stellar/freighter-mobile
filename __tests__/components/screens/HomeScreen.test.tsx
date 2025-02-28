import { HomeScreen } from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testing";
import React from "react";

describe("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText("Home")).toBeTruthy();
  });
});
