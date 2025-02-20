import { render } from "@testing-library/react-native";
import React from "react";

import { HistoryScreen } from "../../../src/components/screens/HistoryScreen";

describe("HistoryScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<HistoryScreen />);
    expect(getByText("History")).toBeTruthy();
  });
});
