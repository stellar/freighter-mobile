import { fireEvent, screen } from "@testing-library/react-native";
import { HomeActionButton } from "components/HomeActionButton";
import Icon, { IconProps } from "components/sds/Icon";
import { getThemeColors } from "config/colors";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";

type TileProps = React.ComponentProps<typeof HomeActionButton>;

// Jest reports no device scheme, so useColors and useTheme resolve
// DEFAULT_COLOR_SCHEME.
const { gray, text } = getThemeColors(DEFAULT_COLOR_SCHEME);

const renderTile = (props: Partial<TileProps> = {}) =>
  renderWithProviders(
    <HomeActionButton
      Icon={Icon.Plus}
      title="Add"
      onPress={jest.fn()}
      testID="icon-button-buy"
      {...props}
    />,
  );

// A TouchableOpacity doesn't pass `className` on to its native view, so the
// classes are read off the element itself. NativeWind doesn't apply them in
// tests, and they are arbitrary values on purpose: with its rem at 14,
// `h-20` would come out at 70pt, not Figma's 82.
const classesOfTile = () =>
  (
    screen.UNSAFE_getByType(RN.TouchableOpacity).props.className as string
  ).split(" ");

describe("HomeActionButton", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the title and calls onPress", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.Plus}
        title="Add"
        onPress={onPress}
        testID="icon-button-buy"
      />,
    );

    expect(getByText("Add")).toBeTruthy();

    fireEvent.press(getByTestId("icon-button-buy"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.ArrowUp}
        title="Send"
        onPress={onPress}
        disabled
        testID="icon-button-send"
      />,
    );

    fireEvent.press(getByTestId("icon-button-send"));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("exposes the disabled state to accessibility", () => {
    const { getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.RefreshCw02}
        title="Swap"
        onPress={jest.fn()}
        disabled
        testID="icon-button-swap"
      />,
    );

    expect(
      getByTestId("icon-button-swap").props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it("is an 82pt tile with 8pt padding and a 4pt gap", () => {
    renderTile();

    expect(classesOfTile()).toEqual(
      expect.arrayContaining([
        "h-[82px]",
        "rounded-[16px]",
        "p-[8px]",
        "gap-[4px]",
      ]),
    );
  });

  // Earn is out of scope, so the three tiles stretch to fill the row, each
  // centring its icon over its label.
  it("shares the row with its siblings and centres its contents", () => {
    renderTile();

    expect(classesOfTile()).toEqual(
      expect.arrayContaining(["flex-1", "items-center", "justify-center"]),
    );
  });

  it("shows the label in Text/MD/600 primary", () => {
    renderTile();

    expect(
      RN.StyleSheet.flatten(screen.getByText("Add").props.style),
    ).toMatchObject({ fontSize: 16, fontWeight: "600", color: text.primary });
  });

  it("draws a 20pt icon with a 2pt stroke in Gray/9", () => {
    const TileIcon = jest.fn<null, [IconProps]>(() => null);

    renderTile({ Icon: TileIcon });

    expect(TileIcon.mock.lastCall?.[0]).toMatchObject({
      size: 20,
      strokeWidth: 2,
      color: gray[9],
    });
  });

  // Gray/2 is #1C1C1C in dark, but Figma's dark tile is Gray/1, #161616.
  it.each([
    ["Gray/2", "light", getThemeColors("light").gray[2]],
    ["Gray/1", "dark", getThemeColors("dark").gray[1]],
  ] as const)("fills with %s in %s", (_shade, scheme, fill) => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

    renderTile();

    expect(
      RN.StyleSheet.flatten(screen.getByTestId("icon-button-buy").props.style)
        .backgroundColor,
    ).toBe(fill);
  });

  it("is dimmed while disabled, and only then", () => {
    const { rerender } = renderTile({ disabled: true });

    expect(classesOfTile()).toContain("opacity-50");

    rerender(
      <HomeActionButton
        Icon={Icon.Plus}
        title="Add"
        onPress={jest.fn()}
        testID="icon-button-buy"
      />,
    );

    expect(classesOfTile()).not.toContain("opacity-50");
  });
});
