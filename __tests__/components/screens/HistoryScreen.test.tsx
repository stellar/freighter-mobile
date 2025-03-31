import { HistoryScreen } from "components/screens/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );
    expect(getByText("History")).toBeTruthy();
  });
});
