import { act, render, screen } from "@testing-library/react-native";
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

const Harness = ({ isPlaying }: { isPlaying: boolean }) => {
  const { waveStyle, coinsStyle, introStyle, cueStyle } =
    useEthenaLaunchEntrance(isPlaying);

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

const play = () => {
  const { rerender } = render(<Harness isPlaying={false} />);
  rerender(<Harness isPlaying />);
};

describe("useEthenaLaunchEntrance", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduceMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("holds every part at its start frame until it plays", () => {
    render(<Harness isPlaying={false} />);
    advance(1000);

    expect(opacityOf("wave")).toBe(0);
    expect(transformOf("wave").translateX).toBeCloseTo(-pxValue(20));
    expect(opacityOf("coins")).toBe(0);
    expect(transformOf("coins").translateY).toBeCloseTo(pxValue(40));
    expect(opacityOf("intro")).toBe(0);
    expect(opacityOf("cue")).toBe(0);
  });

  it("ends with every part in place after a second", () => {
    play();
    advance(1000);

    expect(opacityOf("wave")).toBe(1);
    expect(transformOf("wave").translateX).toBeCloseTo(0);
    expect(opacityOf("coins")).toBe(1);
    expect(transformOf("coins").translateY).toBeCloseTo(0);
    expect(opacityOf("intro")).toBe(1);
    expect(opacityOf("cue")).toBe(1);
  });

  it("moves the art in over its first 800ms", () => {
    play();
    advance(400);

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

  it("fades the intro in from 200ms and the cue from 400ms", () => {
    play();

    advance(150);
    expect(opacityOf("intro")).toBe(0);
    expect(opacityOf("cue")).toBe(0);

    advance(200); // 350ms
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

    render(<Harness isPlaying={false} />);

    expect(opacityOf("wave")).toBe(1);
    expect(transformOf("wave").translateX).toBeCloseTo(0);
    expect(opacityOf("coins")).toBe(1);
    expect(transformOf("coins").translateY).toBeCloseTo(0);
    expect(opacityOf("intro")).toBe(1);
    expect(opacityOf("cue")).toBe(1);
  });
});
