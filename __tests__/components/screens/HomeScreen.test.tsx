import { render } from "@testing-library/react-native";
import { HomeScreen } from "components/screens/HomeScreen";
import React from "react";

describe("HomeScreen", () => {
  it("renders correctly", () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText("Home")).toBeTruthy();
  });
});
