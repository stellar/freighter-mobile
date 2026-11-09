/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { act, render, screen } from "@testing-library/react-native";
import { SplashOverlay } from "components/SplashAnimation/SplashOverlay";
import React from "react";
import { Text } from "react-native";

// The animation itself needs a device. What matters here is only when it
// reports that it has finished, so a stand-in finishes on cue.
let mockFinishSplash: () => void = () => {};
let mockSplashReady: boolean | undefined;

jest.mock("components/SplashAnimation/SplashAnimation", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  const { View } = require("react-native");
  return {
    SplashAnimation: ({
      ready,
      onFinished,
    }: {
      ready: boolean;
      onFinished: () => void;
    }) => {
      mockFinishSplash = onFinished;
      mockSplashReady = ready;
      return <View testID="splash" />;
    },
  };
});

const renderOverlay = (ready = true) =>
  render(
    <SplashOverlay ready={ready}>
      <Text>Wallet</Text>
    </SplashOverlay>,
  );

describe("SplashOverlay", () => {
  it("mounts the app beneath the splash straight away", () => {
    renderOverlay();

    expect(
      screen.getByText("Wallet", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("keeps the app beneath the splash away from screen readers", () => {
    renderOverlay();

    // The overlay blocks touches, but a screen reader walks the accessibility
    // tree directly and would otherwise read and activate the app through it.
    expect(
      screen.queryByText("Wallet", { includeHiddenElements: false }),
    ).toBeNull();
  });

  it("hands the app to screen readers once the splash has finished", () => {
    renderOverlay();

    act(() => mockFinishSplash());

    expect(
      screen.getByText("Wallet", { includeHiddenElements: false }),
    ).toBeTruthy();
  });

  it("removes the splash once it has finished", () => {
    renderOverlay();

    act(() => mockFinishSplash());

    expect(
      screen.queryByTestId("splash", { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("tells the splash when the app is ready", () => {
    renderOverlay(false);
    expect(mockSplashReady).toBe(false);

    screen.rerender(
      <SplashOverlay ready>
        <Text>Wallet</Text>
      </SplashOverlay>,
    );
    expect(mockSplashReady).toBe(true);
  });
});
