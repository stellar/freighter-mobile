import React from "react";
import { render } from "@testing-library/react-native";
import { SwapScreen } from "../../../src/components/screens/SwapScreen";

describe("SwapScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<SwapScreen />);
    expect(getByText("Swap")).toBeTruthy();
  });
});
