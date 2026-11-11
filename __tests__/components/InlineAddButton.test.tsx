import { render, screen, userEvent } from "@testing-library/react-native";
import PlusSvg from "assets/icons/plus.svg";
import { InlineAddButton } from "components/InlineAddButton";
import { getThemeColors } from "config/colors";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

type ButtonProps = React.ComponentProps<typeof InlineAddButton>;

// Jest reports no device scheme, so useColors and useTheme resolve
// DEFAULT_COLOR_SCHEME.
const { gray, text } = getThemeColors(DEFAULT_COLOR_SCHEME);

const renderButton = (props: Partial<ButtonProps> = {}) =>
  render(
    <InlineAddButton
      label="Add token"
      onPress={jest.fn()}
      testID="inline-add"
      {...props}
    />,
  );

// A TouchableOpacity doesn't pass `className` on to its native view, so the
// classes are read off the element itself. NativeWind doesn't apply them in
// tests, and they are arbitrary values on purpose: with its rem at 14,
// `h-11` would come out at 38.5pt, not Figma's 44.
const classesOfButton = () =>
  (screen.UNSAFE_getByType(TouchableOpacity).props.className as string).split(
    " ",
  );

describe("InlineAddButton", () => {
  it("shows the label in Text/MD/600 primary", () => {
    renderButton();

    expect(
      StyleSheet.flatten(screen.getByText("Add token").props.style),
    ).toMatchObject({ fontSize: 16, fontWeight: "600", color: text.primary });
  });

  it("draws an 18pt plus with a 2pt stroke in Gray/9", () => {
    renderButton();

    // Every .svg is the same mock in Jest, and the mock turns a string width
    // into NaN, so the size is read off the svg's own props.
    const plus = screen.UNSAFE_getByType(PlusSvg);

    expect(plus.props.width).toBe(px(18));
    expect(plus.props.height).toBe(px(18));
    // Icon turns points into the 24-unit grid: 2 × 24 / 18.
    expect(plus.props.strokeWidth).toBeCloseTo((2 * 24) / 18, 5);
    expect(plus.props.color).toBe(gray[9]);
  });

  it("is 44pt tall and full width", () => {
    renderButton();

    expect(classesOfButton()).toEqual(
      expect.arrayContaining(["h-[44px]", "w-full", "rounded-full"]),
    );
  });

  it("centres the plus and the label 4pt apart, with 16pt at each side", () => {
    renderButton();

    expect(classesOfButton()).toEqual(
      expect.arrayContaining([
        "flex-row",
        "items-center",
        "justify-center",
        "gap-[4px]",
        "px-[16px]",
      ]),
    );
  });

  it("has no fill and no border, unlike the floating pill it replaces", () => {
    renderButton();

    expect(
      classesOfButton().filter((name) => /^(bg|border)/.test(name)),
    ).toEqual([]);
  });

  it("is a button labelled with its text", () => {
    renderButton();

    const button = screen.getByTestId("inline-add");

    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Add token");
  });

  // userEvent presses through the touchable's own handlers. fireEvent.press
  // would also find the `onPress` prop on InlineAddButton itself, and pass
  // even if the touchable were never wired up.
  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    renderButton({ onPress });

    await userEvent.press(screen.getByTestId("inline-add"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe("when disabled", () => {
    it("doesn't call onPress", async () => {
      const onPress = jest.fn();
      renderButton({ onPress, disabled: true });

      await userEvent.press(screen.getByTestId("inline-add"));

      expect(onPress).not.toHaveBeenCalled();
    });

    it("exposes accessibilityState.disabled", () => {
      renderButton({ disabled: true });

      expect(screen.getByTestId("inline-add").props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
    });

    it("is dimmed, and only then", () => {
      const { rerender } = renderButton({ disabled: true });

      expect(classesOfButton()).toContain("opacity-50");

      rerender(
        <InlineAddButton
          label="Add token"
          onPress={jest.fn()}
          testID="inline-add"
        />,
      );

      expect(classesOfButton()).not.toContain("opacity-50");
      expect(screen.getByTestId("inline-add").props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false }),
      );
    });
  });
});
