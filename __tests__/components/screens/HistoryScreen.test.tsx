import HistoryScreen from "components/screens/HistoryScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe.skip("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByTestId } = renderWithProviders(
      <HistoryScreen navigation={{} as never} route={{} as never} />,
    );
    expect(getByTestId("history-screen")).toBeTruthy();
  });
});
