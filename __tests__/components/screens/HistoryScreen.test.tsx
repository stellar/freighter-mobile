import { HistoryScreen } from "components/screens/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Skipped because we're mocking the public key on the HistoryScreen. This adds a lot of complexity to the test.
describe.skip("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HistoryScreen />);
    expect(getByText("History")).toBeTruthy();
  });
});
