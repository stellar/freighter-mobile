import { within } from "@testing-library/react-native";
import { RecoveryPhraseGrid } from "components/RecoveryPhraseGrid";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";

jest.mock("@react-native-community/blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    BlurView: (props: object) =>
      createElement(View, { ...props, testID: "blur-view" }),
  };
});

// Tests flip these to render the Android frost, on a given Android version.
let mockIsIOS = true;
let mockAndroidApiLevel = 0;
// Defined, not spread: spreading a getter copies its value once, while the
// mock is built, before this file has set them.
jest.mock("helpers/device", () =>
  Object.defineProperties(
    { ...jest.requireActual("helpers/device") },
    {
      isIOS: { get: () => mockIsIOS, enumerable: true },
      androidApiLevel: { get: () => mockAndroidApiLevel, enumerable: true },
    },
  ),
);

const blurOf = (element: { props: { style?: RN.StyleProp<RN.ViewStyle> } }) =>
  RN.StyleSheet.flatten(element.props.style)?.filter;

const WORDS =
  "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode".split(
    " ",
  );

describe("RecoveryPhraseGrid", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockIsIOS = true;
    mockAndroidApiLevel = 0;
  });

  it("lays the words out row by row, numbered", () => {
    const { getByTestId } = renderWithProviders(
      <RecoveryPhraseGrid words={WORDS} />,
    );

    WORDS.forEach((word, index) => {
      const cell = getByTestId(`recovery-phrase-word-${index + 1}`);
      expect(within(cell).getByText(String(index + 1))).toBeTruthy();
      expect(within(cell).getByText(word)).toBeTruthy();
    });
  });

  it("never truncates a word, even under large text", () => {
    const { getByText } = renderWithProviders(
      <RecoveryPhraseGrid words={WORDS} />,
    );

    expect(getByText("mushroom").props.numberOfLines).toBeUndefined();
  });

  it("hides the phrase behind word-shaped placeholders and a frost", () => {
    const { getByTestId, queryByText } = renderWithProviders(
      <RecoveryPhraseGrid />,
    );
    const widths = Array.from(
      { length: 12 },
      (_, index) =>
        RN.StyleSheet.flatten(
          getByTestId(`recovery-phrase-placeholder-${index + 1}`).props.style,
        ).width as number,
    );

    // Words of different lengths, so the frost shows a phrase behind it.
    expect(new Set(widths).size).toBeGreaterThan(1);
    WORDS.forEach((word) => expect(queryByText(word)).toBeNull());
    expect(getByTestId("recovery-phrase-container-frost")).toBeTruthy();
    expect(getByTestId("blur-view")).toBeTruthy();
  });

  // A row's height follows its text, which scales with the screen and the
  // system's text size. Held by a blank line of the same text, a hidden row
  // is as tall as a revealed one, so revealing doesn't move what's below.
  it("holds a hidden row at a revealed row's height", () => {
    const lineStyle = (element: {
      props: { style?: RN.StyleProp<RN.TextStyle> };
    }) => {
      const { fontSize, lineHeight, fontFamily } =
        RN.StyleSheet.flatten(element.props.style) ?? {};
      return { fontSize, lineHeight, fontFamily };
    };
    const hidden = renderWithProviders(<RecoveryPhraseGrid />);
    const revealed = renderWithProviders(<RecoveryPhraseGrid words={WORDS} />);

    expect(
      lineStyle(hidden.getByTestId("recovery-phrase-placeholder-1-line")),
    ).toEqual(lineStyle(revealed.getByText(WORDS[0])));
  });

  it("reads as one hidden element to screen readers", () => {
    const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);
    const grid = getByTestId("recovery-phrase-container");

    expect(grid.props.accessible).toBe(true);
    expect(grid.props.accessibilityLabel).toBe("Recovery phrase hidden");
  });

  // iOS's blur styles add a tint of their own, so the fill over the blur is
  // lighter than Figma's 74%; together they land on Figma's frost.
  it("lays a lighter fill over the iOS blur in dark mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
    const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);

    expect(getByTestId("blur-view").props).toMatchObject({
      blurType: "dark",
      blurAmount: 8,
      reducedTransparencyFallbackColor: "rgba(20, 20, 20, 0.74)",
    });
    expect(
      RN.StyleSheet.flatten(
        getByTestId("recovery-phrase-container-frost-fill").props.style,
      ).backgroundColor,
    ).toBe("rgba(20, 20, 20, 0.5)");
  });

  it("lays a lighter fill over the iOS blur in light mode", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
    const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);

    expect(getByTestId("blur-view").props).toMatchObject({
      blurType: "light",
      blurAmount: 8,
      reducedTransparencyFallbackColor: "rgba(243, 243, 243, 0.74)",
    });
    expect(
      RN.StyleSheet.flatten(
        getByTestId("recovery-phrase-container-frost-fill").props.style,
      ).backgroundColor,
    ).toBe("rgba(243, 243, 243, 0.8)");
  });

  it("uses Figma's 74% fill where there's no live blur", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
    mockIsIOS = false;
    const { getByTestId, queryByTestId } = renderWithProviders(
      <RecoveryPhraseGrid />,
    );

    expect(queryByTestId("blur-view")).toBeNull();
    expect(
      RN.StyleSheet.flatten(
        getByTestId("recovery-phrase-container-frost-fill").props.style,
      ).backgroundColor,
    ).toBe("rgba(243, 243, 243, 0.74)");
  });

  // Android can't blur what's behind a view, but from Android 12 it can blur
  // a view's own content, and the placeholders are all the frost covers.
  describe("on Android", () => {
    beforeEach(() => {
      mockIsIOS = false;
    });

    it("blurs the placeholders under the frost from Android 12, as Figma does", () => {
      mockAndroidApiLevel = 31;
      const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);

      expect(blurOf(getByTestId("recovery-phrase-container-rows"))).toEqual([
        { blur: 7.5 },
      ]);
    });

    it("keeps the plain frost before Android 12, which can't blur", () => {
      mockAndroidApiLevel = 30;
      const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);

      expect(blurOf(getByTestId("recovery-phrase-container-rows"))).toBeFalsy();
    });

    it("never blurs the revealed words", () => {
      mockAndroidApiLevel = 31;
      const { getByTestId } = renderWithProviders(
        <RecoveryPhraseGrid words={WORDS} />,
      );

      expect(blurOf(getByTestId("recovery-phrase-container-rows"))).toBeFalsy();
    });
  });

  it("leaves the placeholders sharp on iOS, whose frost blurs what's behind it", () => {
    const { getByTestId } = renderWithProviders(<RecoveryPhraseGrid />);

    expect(blurOf(getByTestId("recovery-phrase-container-rows"))).toBeFalsy();
  });
});
