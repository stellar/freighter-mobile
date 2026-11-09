import { screen } from "@testing-library/react-native";
import { HeaderFade } from "components/layout/HeaderFade";
import { getThemeColors } from "config/colors";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { StyleSheet } from "react-native";
import { Stop } from "react-native-svg";

// Figma's Top (?node-id=3705-77862 light, 3272-113092 dark): content
// scrolls up under the header and fades out below the row. Its 140pt frame
// stays solid to 82.571% (light) or 80.714% (dark) and is clear at 103.21%
// or 93.214%. The fade keeps those distances from its bottom edge, so it
// fits any header height.
describe("HeaderFade", () => {
  afterEach(() => jest.restoreAllMocks());

  const stops = () =>
    screen.UNSAFE_root.findAll((node) => node.type === Stop).map((node) => ({
      offset: node.props.offset,
      opacity: node.props.stopOpacity,
      color: node.props.stopColor,
    }));

  const styleOf = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style);

  it("fades white out over the last 24.4pt, to 16% at the bottom edge, in light mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
    const white = getThemeColors("light").base[0];

    renderWithProviders(<HeaderFade />);

    // Solid down to the strip, then the page color fading out.
    expect(styleOf("header-fade-solid")).toMatchObject({
      backgroundColor: white,
    });
    expect(styleOf("header-fade-strip").height).toBeCloseTo(24.4, 1);
    const [top, bottom] = stops();
    expect(top).toEqual({ offset: 0, opacity: 1, color: white });
    expect(bottom.offset).toBe(1);
    expect(bottom.opacity).toBeCloseTo(0.1555, 3);
    expect(bottom.color).toBe(white);
    expect(stops()).toHaveLength(2);
  });

  it("fades black out over the last 27pt, clear 9.5pt above the bottom edge, in dark mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    const black = getThemeColors("dark").base[0];

    renderWithProviders(<HeaderFade />);

    expect(styleOf("header-fade-solid")).toMatchObject({
      backgroundColor: black,
    });
    expect(styleOf("header-fade-strip").height).toBeCloseTo(27, 1);
    const [top, clear, bottom] = stops();
    expect(top).toEqual({ offset: 0, opacity: 1, color: black });
    expect(clear.offset).toBeCloseTo(0.6481, 3);
    expect(clear.opacity).toBe(0);
    expect(bottom).toEqual({ offset: 1, opacity: 0, color: black });
  });

  it("fills its parent and lets touches through to the content under it", () => {
    renderWithProviders(<HeaderFade />);

    const fade = screen.getByTestId("header-fade");
    expect(fade.props.pointerEvents).toBe("none");
    expect(StyleSheet.flatten(fade.props.style)).toMatchObject(
      StyleSheet.absoluteFillObject,
    );
  });
});
