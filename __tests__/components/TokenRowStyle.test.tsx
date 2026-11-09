import { render } from "@testing-library/react-native";
import { TokenRowDivider } from "components/TokenRowStyle";
import React from "react";
import { StyleSheet } from "react-native";

describe("TokenRowDivider", () => {
  it("renders a 1pt divider inset to the text column", () => {
    const { getByTestId } = render(<TokenRowDivider />);
    const divider = getByTestId("token-row-divider");

    // NativeWind doesn't apply classes in tests, so the line's height and
    // colour are read off the class names.
    expect(divider.props.className).toContain("h-[1px]");
    expect(divider.props.className).toContain("bg-border-primary");
    // The 40pt token icon and the 16pt gap before the name and amount.
    expect(StyleSheet.flatten(divider.props.style)).toMatchObject({
      marginLeft: 56,
    });
  });

  it("lets a caller name its own divider", () => {
    const { getByTestId, queryByTestId } = render(
      <TokenRowDivider testID="collectible-row-divider" />,
    );

    expect(getByTestId("collectible-row-divider")).toBeTruthy();
    expect(queryByTestId("token-row-divider")).toBeNull();
  });
});
