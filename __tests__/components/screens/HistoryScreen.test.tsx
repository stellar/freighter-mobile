import { render } from "@testing-library/react-native";
import { HistoryScreen } from "components/screens/HistoryScreen";
import React from "react";

describe("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<HistoryScreen />);
    expect(getByText("History")).toBeTruthy();
  });
});
