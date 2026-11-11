import { FocusRing } from "components/FocusRing";
import { Text } from "components/sds/Typography";
import { getThemeColors } from "config/colors";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";

describe("FocusRing", () => {
  it("shows Varial's ring and fills the field while focused", () => {
    const { getByTestId } = renderWithProviders(
      <FocusRing isFocused testID="ring">
        <Text>field</Text>
      </FocusRing>,
    );

    expect(
      StyleSheet.flatten(getByTestId("ring").props.style).borderColor,
    ).toBe("rgba(143, 143, 143, 0.12)");
    expect(
      StyleSheet.flatten(getByTestId("ring-fill").props.style).backgroundColor,
    ).toBe(getThemeColors("light").base[0]);
  });

  it("draws nothing around an unfocused field, without moving it", () => {
    const { getByTestId } = renderWithProviders(
      <FocusRing isFocused={false} testID="ring">
        <Text>field</Text>
      </FocusRing>,
    );

    expect(StyleSheet.flatten(getByTestId("ring").props.style)).toMatchObject({
      borderColor: "transparent",
      borderWidth: 4,
      margin: -4,
    });
    expect(
      StyleSheet.flatten(getByTestId("ring-fill").props.style).backgroundColor,
    ).toBe("transparent");
  });
});
