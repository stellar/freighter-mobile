import { act } from "@testing-library/react-native";
import Shimmer, { SHIMMER_PILL_RADIUS } from "components/sds/Shimmer";
import { shimmerProgress } from "components/sds/Shimmer/clock";
import { getThemeColors } from "config/colors";
import { findAllRenderedByType, renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { StyleSheet } from "react-native";

// `useColorScheme` reports "light" under the react-native jest preset.
const themeColors = getThemeColors("light");

const mockReduceMotion = jest.fn(() => false);
jest.mock("hooks/useIsReduceMotionEnabled", () => () => mockReduceMotion());

const render = (props: Partial<React.ComponentProps<typeof Shimmer>> = {}) =>
  renderWithProviders(
    <Shimmer testID="shimmer" width={146} height={24} {...props} />,
  );

describe("Shimmer", () => {
  beforeEach(() => mockReduceMotion.mockReturnValue(false));

  it("reserves exactly the requested box and hides itself from assistive tech", () => {
    const { getByTestId, queryByTestId } = render();
    expect(queryByTestId("shimmer")).toBeNull();
    const box = getByTestId("shimmer", { includeHiddenElements: true });
    expect(StyleSheet.flatten(box.props.style)).toEqual({
      width: 146,
      height: 24,
    });
    expect(box.props.accessibilityElementsHidden).toBe(true);
    expect(box.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("draws a rounded base between the page base and gray 5, and a white highlight", () => {
    const { toJSON } = render();
    const tree = toJSON();
    const base = findAllRenderedByType(tree, "skRRect")[0];
    expect(base.props.r).toBe(SHIMMER_PILL_RADIUS);
    const gradients = findAllRenderedByType(tree, "skLinearGradient");
    // Light: base → gray 5, left to right, as the light frame draws it.
    expect(gradients[0].props.colors).toEqual([
      themeColors.base[0],
      themeColors.gray[5],
    ]);
    // Highlight: five white stops, 0 / 3 / 7 / 3 / 0 percent.
    expect(gradients[1].props.colors).toEqual([
      "#ffffff00",
      "#ffffff08",
      "#ffffff12",
      "#ffffff08",
      "#ffffff00",
    ]);
    expect(gradients[1].props.positions).toEqual([0, 0.3, 0.5, 0.7, 1]);
    expect(findAllRenderedByType(tree, "skRect")).toHaveLength(1);
  });

  it("draws the dark base from gray 5 to the page base, as the dark frame does", () => {
    const scheme = jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    try {
      const dark = getThemeColors("dark");
      const { toJSON } = render();
      const gradients = findAllRenderedByType(toJSON(), "skLinearGradient");
      expect(gradients[0].props.colors).toEqual([dark.gray[5], dark.base[0]]);
    } finally {
      scheme.mockRestore();
    }
  });

  it("sweeps the highlight from -width to +width as the clock runs 0 to 1", () => {
    // The derived transform recomputes on the next frame, which only fake
    // timers can step.
    jest.useFakeTimers();
    try {
      const { toJSON } = render();
      const highlight = findAllRenderedByType(toJSON(), "skGroup").find(
        (group) => group.props.transform,
      );
      const { transform } = highlight!.props as {
        transform: { value: unknown };
      };

      act(() => {
        shimmerProgress.value = 0;
        jest.advanceTimersByTime(20);
      });
      expect(transform.value).toEqual([{ translateX: -146 }]);

      act(() => {
        shimmerProgress.value = 1;
        jest.advanceTimersByTime(20);
      });
      expect(transform.value).toEqual([{ translateX: 146 }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses the stronger highlight and the border colour for the hairline", () => {
    const { toJSON } = render({ variant: "hairline", height: 1, radius: 0 });
    const tree = toJSON();
    const gradients = findAllRenderedByType(tree, "skLinearGradient");
    expect(gradients[0].props.colors).toEqual([
      themeColors.border.primary,
      themeColors.border.primary,
    ]);
    expect(gradients[1].props.colors).toEqual([
      "#ffffff00",
      "#ffffff14",
      "#ffffff26",
      "#ffffff14",
      "#ffffff00",
    ]);
  });

  it("draws no highlight under reduced motion", () => {
    mockReduceMotion.mockReturnValue(true);
    const { toJSON } = render();
    const tree = toJSON();
    expect(findAllRenderedByType(tree, "skRRect")).toHaveLength(1);
    expect(findAllRenderedByType(tree, "skRect")).toHaveLength(0);
  });

  it("renders no canvas at width 0", () => {
    // Review focus 1: a parent that has not measured yet.
    const { toJSON } = render({ width: 0 });
    const tree = toJSON();
    expect(findAllRenderedByType(tree, "skRRect")).toHaveLength(0);
  });
});
