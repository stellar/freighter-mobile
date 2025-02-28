import { SwapScreen } from "components/screens/SwapScreen";
import { renderWithProviders } from "helpers/testing";
import React from "react";

describe("SwapScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<SwapScreen />);
    expect(getByText("Swap")).toBeTruthy();
  });
});
