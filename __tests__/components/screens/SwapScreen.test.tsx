import { render } from "@testing-library/react-native";
import { SwapScreen } from "components/screens/SwapScreen";
import React from "react";

describe("SwapScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<SwapScreen />);
    expect(getByText("Swap")).toBeTruthy();
  });
});
