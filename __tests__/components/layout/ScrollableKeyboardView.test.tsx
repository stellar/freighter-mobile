import { render } from "@testing-library/react-native";
import { ScrollableKeyboardView } from "components/layout/ScrollableKeyboardView";
import React from "react";
import { KeyboardAvoidingView, Text } from "react-native";

let mockIsIOS = true;
let mockIsKeyboardVisible = false;
// Defined, not spread: spreading a getter copies its value once, while the
// mock is built, before this file has set mockIsIOS.
jest.mock("helpers/device", () =>
  Object.defineProperty({ ...jest.requireActual("helpers/device") }, "isIOS", {
    get: () => mockIsIOS,
    enumerable: true,
  }),
);
jest.mock("hooks/useKeyboardVisible", () => () => mockIsKeyboardVisible);

const avoidsKeyboard = () => {
  const screen = render(
    <ScrollableKeyboardView>
      <Text>Content</Text>
    </ScrollableKeyboardView>,
  );

  // KeyboardAvoidingView is on unless told otherwise.
  return (screen.UNSAFE_getByType(KeyboardAvoidingView).props.enabled ??
    true) as boolean;
};

describe("ScrollableKeyboardView", () => {
  afterEach(() => {
    mockIsIOS = true;
    mockIsKeyboardVisible = false;
  });

  it("avoids the keyboard on iOS", () => {
    expect(avoidsKeyboard()).toBe(true);
  });

  // Android reports a hidden keyboard's position as the visible area's
  // height, so the view would otherwise keep the status and navigation bars'
  // height as padding once the keyboard hides.
  describe("on Android", () => {
    beforeEach(() => {
      mockIsIOS = false;
    });

    it("avoids the keyboard while it's up", () => {
      mockIsKeyboardVisible = true;

      expect(avoidsKeyboard()).toBe(true);
    });

    it("adds no padding once the keyboard has hidden", () => {
      mockIsKeyboardVisible = false;

      expect(avoidsKeyboard()).toBe(false);
    });
  });
});
