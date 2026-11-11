import { fireEvent } from "@testing-library/react-native";
import { Checkbox } from "components/sds/Checkbox";
import { getThemeColors } from "config/colors";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";

const LABEL = "I understand";

const renderCheckbox = (
  checked: boolean,
  onChange = jest.fn(),
  disabled = false,
) =>
  renderWithProviders(
    <Checkbox
      testID="checkbox"
      checked={checked}
      onChange={onChange}
      label={LABEL}
      disabled={disabled}
    />,
  );

describe("Checkbox", () => {
  afterEach(() => jest.restoreAllMocks());

  it("checks and unchecks from the box or its label", () => {
    const onChange = jest.fn();
    const { getByTestId, getByText, rerender } = renderCheckbox(
      false,
      onChange,
    );

    fireEvent.press(getByTestId("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(
      <Checkbox testID="checkbox" checked onChange={onChange} label={LABEL} />,
    );
    fireEvent.press(getByText(LABEL));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("tells screen readers it is a checkbox and whether it is checked", () => {
    const { getByTestId } = renderCheckbox(true);

    expect(getByTestId("checkbox").props.accessibilityRole).toBe("checkbox");
    expect(getByTestId("checkbox").props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it("draws the check only when checked", () => {
    expect(renderCheckbox(false).queryByTestId("SvgMock")).toBeNull();
    expect(renderCheckbox(true).getByTestId("SvgMock")).toBeTruthy();
  });

  it("fills the checked box with Varial Blue in light mode", () => {
    const { getByTestId } = renderCheckbox(true);

    expect(
      RN.StyleSheet.flatten(getByTestId("checkbox-box").props.style)
        .backgroundColor,
    ).toBe(getThemeColors("light").lilac[9]);
  });

  it("fills the checked box with Varial Blue in dark mode too", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    const { getByTestId } = renderCheckbox(true);

    expect(
      RN.StyleSheet.flatten(getByTestId("checkbox-box").props.style)
        .backgroundColor,
    ).toBe(getThemeColors("dark").lilac[9]);
  });

  it("ignores presses while disabled", () => {
    const onChange = jest.fn();
    const { getByTestId } = renderCheckbox(false, onChange, true);

    fireEvent.press(getByTestId("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
