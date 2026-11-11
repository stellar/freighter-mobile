import { render, screen } from "@testing-library/react-native";
import {
  isPillBlurSupported,
  renderPillBlurScreenLayout,
} from "components/FloatingTabBar/PillBlur";
import React from "react";
import { StyleSheet, Text } from "react-native";

describe("isPillBlurSupported", () => {
  // Android blurs on RenderNodes from 12 (API 31). Before that the library
  // falls back to software snapshots, which broke screen transitions. iOS
  // blurs with its own view, not this one.
  it.each([
    ["android", 31, true],
    ["android", 36, true],
    ["android", 30, false],
    ["android", 24, false],
    ["ios", 0, false],
  ] as const)("on %s API %i, is %s", (os, apiLevel, supported) => {
    expect(isPillBlurSupported(os, apiLevel)).toBe(supported);
  });
});

describe("renderPillBlurScreenLayout", () => {
  it("wraps the screen in a blur target that fills it", () => {
    render(
      renderPillBlurScreenLayout({
        children: <Text>screen</Text>,
      } as Parameters<typeof renderPillBlurScreenLayout>[0]),
    );

    const target = screen.getByTestId("pill-blur-target");

    expect(target.type).toBe("FreighterPillBlurTarget");
    expect(StyleSheet.flatten(target.props.style)).toMatchObject({ flex: 1 });
    expect(screen.getByText("screen")).toBeTruthy();
  });
});
