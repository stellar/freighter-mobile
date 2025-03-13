import { DiscoveryScreen } from "components/screens/DiscoveryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("DiscoveryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<DiscoveryScreen />);
    expect(getByText("Discovery")).toBeTruthy();
  });
});
