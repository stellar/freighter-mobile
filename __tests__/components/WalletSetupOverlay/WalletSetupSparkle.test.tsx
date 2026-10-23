import { act, render } from "@testing-library/react-native";
import { WalletSetupSparkle } from "components/WalletSetupOverlay/WalletSetupSparkle";
import { pxValue } from "helpers/dimensions";
import React from "react";
import * as RN from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

const TEST_ID = "sparkle";

type Transform = readonly Record<string, number>[];

/** The sparkle's current transform, as one object: translateX, scaleY... */
const transformOf = (element: Parameters<typeof getAnimatedStyle>[0]) =>
  Object.assign(
    {},
    ...((getAnimatedStyle(element) as unknown as { transform?: Transform })
      .transform ?? []),
  ) as Record<string, number>;

describe("WalletSetupSparkle", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("draws the dark sparkle in dark mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    const { getByTestId, queryByTestId } = render(
      <WalletSetupSparkle isLooping={false} testID={TEST_ID} />,
    );

    expect(getByTestId(`${TEST_ID}-dark`)).toBeTruthy();
    expect(queryByTestId(`${TEST_ID}-light`)).toBeNull();
  });

  it("draws the light sparkle in light mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
    const { getByTestId, queryByTestId } = render(
      <WalletSetupSparkle isLooping={false} testID={TEST_ID} />,
    );

    expect(getByTestId(`${TEST_ID}-light`)).toBeTruthy();
    expect(queryByTestId(`${TEST_ID}-dark`)).toBeNull();
  });

  it("rests at the center when not looping", () => {
    const { getByTestId } = render(
      <WalletSetupSparkle isLooping={false} testID={TEST_ID} />,
    );

    // Numerically, since the rest pose's translateX is -6 × 0, which is -0.
    const transform = transformOf(getByTestId(TEST_ID));
    expect(transform.translateX).toBeCloseTo(0, 9);
    expect(transform.translateY).toBeCloseTo(0, 9);
    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
  });

  it("hops from 6pt left of center when looping", () => {
    const { getByTestId } = render(
      <WalletSetupSparkle isLooping testID={TEST_ID} />,
    );
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(transformOf(getByTestId(TEST_ID)).translateX).toBeCloseTo(
      -6 * pxValue(1),
      0,
    );

    // 12% into the 1.5s loop is the first hop's peak, 5pt up.
    act(() => {
      jest.advanceTimersByTime(180 - 16);
    });
    expect(transformOf(getByTestId(TEST_ID)).translateY).toBeCloseTo(
      -5 * pxValue(1),
      0,
    );
  });

  it("settles at the center when the loop stops mid-hop", () => {
    const { getByTestId, rerender } = render(
      <WalletSetupSparkle isLooping testID={TEST_ID} />,
    );
    act(() => {
      jest.advanceTimersByTime(180);
    });
    expect(transformOf(getByTestId(TEST_ID)).translateY).not.toBeCloseTo(0, 1);

    rerender(<WalletSetupSparkle isLooping={false} testID={TEST_ID} />);
    act(() => {
      jest.advanceTimersByTime(300);
    });

    const transform = transformOf(getByTestId(TEST_ID));
    expect(transform.translateX).toBeCloseTo(0, 3);
    expect(transform.translateY).toBeCloseTo(0, 3);
    expect(transform.scaleX).toBeCloseTo(1, 3);
    expect(transform.scaleY).toBeCloseTo(1, 3);
  });
});
