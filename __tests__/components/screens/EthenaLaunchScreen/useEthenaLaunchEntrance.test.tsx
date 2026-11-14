import { act, render, screen } from "@testing-library/react-native";
import { ETHENA_LAUNCH_FADE_MS } from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import { useEthenaLaunchEntrance } from "components/screens/EthenaLaunchScreen/useEthenaLaunchEntrance";
import { pxValue } from "helpers/dimensions";
import React from "react";
import Animated, { getAnimatedStyle } from "react-native-reanimated";

// Reduce Motion comes from Reanimated, which knows it from launch.
const mockReduceMotion = jest.fn(() => false);
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual<object>("react-native-reanimated"),
  useReducedMotion: () => mockReduceMotion(),
}));

// The entrance starts as the promo's route finishes fading in (its length per
// platform is pinned in ethenaLaunchConfig.test.ts).
const FADE_IN = ETHENA_LAUNCH_FADE_MS;

const Harness = () => {
  const { waveStyle, coinsStyle, introStyle, cueStyle } =
    useEthenaLaunchEntrance();

  return (
    <>
      <Animated.View testID="wave" style={waveStyle} />
      <Animated.View testID="coins" style={coinsStyle} />
      <Animated.View testID="intro" style={introStyle} />
      <Animated.View testID="cue" style={cueStyle} />
    </>
  );
};

type Element = Parameters<typeof getAnimatedStyle>[0];
const styleOf = (testID: string) =>
  getAnimatedStyle(screen.getByTestId(testID) as unknown as Element) as {
    opacity?: number;
    transform?: readonly Record<string, number>[];
  };
const transformOf = (testID: string): Record<string, number> =>
  Object.assign({}, ...(styleOf(testID).transform ?? []));
const opacityOf = (testID: string) => styleOf(testID).opacity ?? 1;

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe("useEthenaLaunchEntrance", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduceMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("holds every part at its start frame while the promo fades in", () => {
    render(<Harness />);
    advance(FADE_IN - 10);

    expect(opacityOf("wave")).toBe(0);
    expect(transformOf("wave").translateX).toBeCloseTo(-pxValue(20));
    expect(opacityOf("coins")).toBe(0);
    expect(transformOf("coins").translateY).toBeCloseTo(pxValue(40));
    expect(opacityOf("intro")).toBe(0);
    expect(opacityOf("cue")).toBe(0);
  });

  it("plays on its own, with no event to wait for, and ends a second after the fade-in", () => {
    render(<Harness />);
    advance(FADE_IN + 1000);

    expect(opacityOf("wave")).toBe(1);
    expect(transformOf("wave").translateX).toBeCloseTo(0);
    expect(opacityOf("coins")).toBe(1);
    expect(transformOf("coins").translateY).toBeCloseTo(0);
    expect(opacityOf("intro")).toBe(1);
    expect(opacityOf("cue")).toBe(1);
  });

  it("moves the art in over the 800ms after the fade-in", () => {
    render(<Harness />);
    advance(FADE_IN + 400);

    const waveShift = transformOf("wave").translateX;
    const coinsRise = transformOf("coins").translateY;
    expect(waveShift).toBeLessThan(0);
    expect(waveShift).toBeGreaterThan(-pxValue(20));
    expect(coinsRise).toBeGreaterThan(0);
    expect(coinsRise).toBeLessThan(pxValue(40));
    expect(opacityOf("wave")).toBeGreaterThan(0);
    expect(opacityOf("wave")).toBeLessThan(1);

    advance(450);
    expect(transformOf("wave").translateX).toBeCloseTo(0);
    expect(opacityOf("coins")).toBe(1);
  });

  it("fades the intro in from 200ms and the cue from 400ms after the fade-in", () => {
    render(<Harness />);

    advance(FADE_IN + 150);
    expect(opacityOf("intro")).toBe(0);
    expect(opacityOf("cue")).toBe(0);

    advance(200); // 350ms into the entrance
    expect(opacityOf("intro")).toBeGreaterThan(0);
    expect(opacityOf("intro")).toBeLessThan(1);
    expect(opacityOf("cue")).toBe(0);

    advance(400); // 750ms
    expect(opacityOf("intro")).toBe(1);
    expect(opacityOf("cue")).toBeGreaterThan(0);
    expect(opacityOf("cue")).toBeLessThan(1);

    advance(200); // 950ms
    expect(opacityOf("cue")).toBe(1);
  });

  it("shows the end frame at once under Reduce Motion", () => {
    mockReduceMotion.mockReturnValue(true);

    render(<Harness />);

    expect(opacityOf("wave")).toBe(1);
    expect(transformOf("wave").translateX).toBeCloseTo(0);
    expect(opacityOf("coins")).toBe(1);
    expect(transformOf("coins").translateY).toBeCloseTo(0);
    expect(opacityOf("intro")).toBe(1);
    expect(opacityOf("cue")).toBe(1);
  });
});
