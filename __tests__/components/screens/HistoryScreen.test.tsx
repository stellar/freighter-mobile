import { HistoryScreen } from "components/screens/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HistoryScreen />);
    expect(getByText("History")).toBeTruthy();
  });
});
