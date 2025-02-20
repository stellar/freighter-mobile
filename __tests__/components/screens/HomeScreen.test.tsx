import { render } from "@testing-library/react-native";
import React from "react";

import { HomeScreen } from "../../../src/components/screens/HomeScreen";

describe("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText("Home")).toBeTruthy();
  });
});
