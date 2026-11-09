import { render, screen, within } from "@testing-library/react-native";
import {
  PillBackground,
  getPillMaterial,
  getPillSelectionColor,
} from "components/FloatingTabBar/PillBackground";
import { getThemeColors } from "config/colors";
import { SHADOW_COLOR } from "config/theme";
import { RenderedNode } from "helpers/testUtils";
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

// Tests set the Android version the pill runs on. Defined, not spread:
// spreading a getter copies its value once, while the mock is built, before
// the tests have set it.
let mockAndroidApiLevel = 0;
jest.mock("helpers/device", () =>
  Object.defineProperties(
    { ...jest.requireActual("helpers/device") },
    { androidApiLevel: { get: () => mockAndroidApiLevel, enumerable: true } },
  ),
);

/** Figma's pill: 227 by 64 (Tab Bar Buttons, ?node-id=3675-56991). */
const PILL = { width: 227, height: 64 };

/**
 * Each scheme's pill (Figma ?node-id=3675-56991): a translucent fill over a
 * 4pt background blur. Figma's light fill is 86% white. Its dark fill is 85%
 * #3C3C3C under color-burn and darken layers, which React Native can't blend,
 * so it's the plain fill they come out to: about 83% #212121, #1C1C1C over
 * black. That's Android's fill, which has no blur under it.
 *
 * iOS's blur styles add a tint of their own, measured on an iPhone SE
 * simulator: light lets 70% of the backdrop through over a 77 gray floor,
 * dark 27% over a 20 floor. So the fill over the blur is lighter, chosen so
 * that the blur and the fill together come out as Figma's: 80% white in light,
 * 38% #282828 in dark. The solid surface (Gray/1, Gray/2) stands in where
 * there's no transparency.
 */
const SCHEMES = [
  {
    scheme: "light",
    blurType: "light",
    fill: { r: 255, g: 255, b: 255, a: 0.86 },
    blurredFill: { r: 255, g: 255, b: 255, a: 0.8 },
    surface: getThemeColors("light").gray[1],
  },
  {
    scheme: "dark",
    blurType: "dark",
    fill: { r: 33, g: 33, b: 33, a: 0.83 },
    blurredFill: { r: 40, g: 40, b: 40, a: 0.38 },
    surface: getThemeColors("dark").gray[2],
  },
] as const;

const styleOf = (testID: string) =>
  RN.StyleSheet.flatten(screen.getByTestId(testID).props.style);

/* eslint-disable no-bitwise -- unpacks the 0xAARRGGBB integer RN reads */
/**
 * A color's channels however it's written (hex with alpha, rgba(), ...), as
 * React Native reads it, so a test pins the color and not its spelling.
 */
const channelsOf = (color: RN.ColorValue | undefined) => {
  const argb = RN.processColor(color) as number;

  return {
    r: (argb >>> 16) & 0xff,
    g: (argb >>> 8) & 0xff,
    b: argb & 0xff,
    a: (argb >>> 24) / 0xff,
  };
};
/* eslint-enable no-bitwise */

const expectFill = (
  color: RN.ColorValue | undefined,
  fill: { r: number; g: number; b: number; a: number },
) =>
  expect(channelsOf(color)).toEqual({ ...fill, a: expect.closeTo(fill.a, 2) });

/** Figma's pill shadow, 0 8 40 at 12% black, the same in both schemes. */
const expectFigmaShadow = (shadow: RN.ViewStyle["boxShadow"]) => {
  expect(shadow).toEqual([
    { offsetX: 0, offsetY: 8, blurRadius: 40, color: expect.any(String) },
  ]);
  const [{ color }] = shadow as RN.BoxShadowValue[];

  // Built from SHADOW_COLOR: black in either scheme, never an inverting color.
  expect(channelsOf(color)).toEqual({
    ...channelsOf(SHADOW_COLOR),
    a: expect.closeTo(0.12, 2),
  });
};

describe("getPillMaterial", () => {
  it.each([
    ["ios", 0, "blurred"],
    ["android", 31, "blurred"],
    ["android", 36, "blurred"],
    ["android", 30, "translucent"],
    ["android", 24, "translucent"],
  ] as const)("on %s API %i, is %s", (os, apiLevel, material) => {
    expect(getPillMaterial(os, apiLevel)).toBe(material);
  });
});

describe("PillBackground", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockAndroidApiLevel = 0;
  });

  describe("blurred", () => {
    describe.each(SCHEMES)(
      "in $scheme",
      ({ scheme, blurType, blurredFill, surface }) => {
        beforeEach(() => {
          jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);
        });

        it("blurs what's behind it by 4, with the classic style, under a fill that adds up to Figma's", () => {
          render(<PillBackground {...PILL} material="blurred" />);

          expect(screen.getByTestId("blur-view").props).toMatchObject({
            blurType,
            blurAmount: 4,
            reducedTransparencyFallbackColor: surface,
          });
          expectFill(styleOf("pill-blurred-fill").backgroundColor, blurredFill);
        });

        it("casts Figma's shadow", () => {
          render(<PillBackground {...PILL} material="blurred" />);

          expectFigmaShadow(styleOf("pill-blurred").boxShadow);
        });
      },
    );

    // On iOS a BlurView's own radius doesn't clip the native blur, so a parent
    // with the radius does. A shadow on that parent would be clipped with it,
    // so the shadow sits on a view around it.
    it("clips the blur with its own rounded view, inside the one that casts the shadow", () => {
      render(<PillBackground {...PILL} material="blurred" />);

      expect(styleOf("pill-blurred-clip")).toMatchObject({
        width: 227,
        height: 64,
        borderRadius: 32,
        overflow: "hidden",
      });
      expect(styleOf("pill-blurred-clip").boxShadow).toBeUndefined();
      expect(styleOf("pill-blurred").overflow).not.toBe("hidden");
      expect(
        within(screen.getByTestId("pill-blurred")).getByTestId(
          "pill-blurred-clip",
        ),
      ).toBeTruthy();
    });

    it("keeps its children above the blur and the fill", () => {
      render(
        <PillBackground {...PILL} material="blurred">
          <RN.View testID="tabs" />
        </PillBackground>,
      );

      const root = screen.toJSON() as RenderedNode;
      const clip = root.children?.[0] as RenderedNode;

      expect(
        clip.children?.map((layer) => (layer as RenderedNode).props.testID),
      ).toEqual(["blur-view", "pill-blurred-fill", "tabs"]);
    });
  });

  describe("translucent", () => {
    it.each(SCHEMES)(
      "fills with Figma's translucent fill in $scheme, with its shadow and no blur",
      ({ scheme, fill }) => {
        jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

        render(<PillBackground {...PILL} material="translucent" />);

        expectFill(styleOf("pill-translucent").backgroundColor, fill);
        expectFigmaShadow(styleOf("pill-translucent").boxShadow);
        expect(screen.queryByTestId("blur-view")).toBeNull();
      },
    );

    it("treats a device that reports no scheme as light", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue(null);

      render(<PillBackground {...PILL} material="translucent" />);

      expectFill(styleOf("pill-translucent").backgroundColor, SCHEMES[0].fill);
    });

    // React Native draws a boxShadow on Android only from API level 28. Before
    // that the pill needs an elevation to have a shadow at all, and an
    // elevation shadow would show through a translucent fill, so the fill
    // turns solid there. From 28 on it must not have one, or it would cast two.
    describe("on Android", () => {
      beforeEach(() => {
        jest.replaceProperty(RN.Platform, "OS", "android");
      });

      it.each([24, 27])(
        "goes solid with an elevation shadow on API level %i, where boxShadow isn't drawn",
        (apiLevel) => {
          mockAndroidApiLevel = apiLevel;

          render(<PillBackground {...PILL} material="translucent" />);

          expect(styleOf("pill-translucent")).toMatchObject({
            elevation: 8,
            backgroundColor: getThemeColors("light").gray[1],
          });
        },
      );

      it.each([28, 34])(
        "stays translucent, with only Figma's boxShadow, on API level %i",
        (apiLevel) => {
          mockAndroidApiLevel = apiLevel;

          render(<PillBackground {...PILL} material="translucent" />);

          expect(styleOf("pill-translucent").elevation).toBeUndefined();
          expectFill(
            styleOf("pill-translucent").backgroundColor,
            SCHEMES[0].fill,
          );
          expectFigmaShadow(styleOf("pill-translucent").boxShadow);
        },
      );
    });
  });

  it.each(["blurred", "translucent"] as const)(
    "rounds the %s pill fully, whatever its size",
    (material) => {
      render(<PillBackground width={100} height={40} material={material} />);

      expect(styleOf(`pill-${material}`)).toMatchObject({
        width: 100,
        height: 40,
        borderRadius: 20,
      });
    },
  );

  it.each(["blurred", "translucent"] as const)(
    "holds its children in the %s pill",
    (material) => {
      render(
        <PillBackground {...PILL} material={material}>
          <RN.View testID="tabs" />
        </PillBackground>,
      );

      expect(
        within(screen.getByTestId(`pill-${material}`)).getByTestId("tabs"),
      ).toBeTruthy();
    },
  );

  // Android 12+ blurs with Dimezis BlurView 3 (PillBlurPackage), which adds
  // no tint of its own, so Figma's fill goes over it as it is.
  describe("blurred on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(RN.Platform, "OS", "android");
    });

    it.each(SCHEMES)(
      "blurs by 4 under Figma's fill in $scheme",
      ({ scheme, fill }) => {
        jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

        render(<PillBackground {...PILL} material="blurred" />);

        const blur = screen.getByTestId("blur-view");
        expect(blur.type).toBe("FreighterPillBlurView");
        expect(blur.props.blurRadius).toBe(4);
        expectFill(styleOf("pill-blurred-fill").backgroundColor, fill);
        expectFigmaShadow(styleOf("pill-blurred").boxShadow);
      },
    );
  });

  describe("without a material", () => {
    it("is blurred on iOS", () => {
      render(<PillBackground {...PILL} />);

      expect(screen.getByTestId("pill-blurred")).toBeTruthy();
    });

    it("is blurred on Android 12 and later", () => {
      jest.replaceProperty(RN.Platform, "OS", "android");
      mockAndroidApiLevel = 31;

      render(<PillBackground {...PILL} />);

      expect(screen.getByTestId("pill-blurred")).toBeTruthy();
      expect(screen.getByTestId("blur-view").type).toBe(
        "FreighterPillBlurView",
      );
    });

    it("is translucent before Android 12, with no blur", () => {
      jest.replaceProperty(RN.Platform, "OS", "android");
      mockAndroidApiLevel = 30;

      render(<PillBackground {...PILL} />);

      expect(screen.getByTestId("pill-translucent")).toBeTruthy();
      expect(screen.queryByTestId("blur-view")).toBeNull();
    });
  });
});

describe("getPillSelectionColor", () => {
  it("is Figma's selection layer in light", () => {
    expect(getPillSelectionColor("light", getThemeColors("light"))).toBe(
      "rgba(153, 153, 153, 0.15)",
    );
  });

  it("is Gray/4 in dark", () => {
    const colors = getThemeColors("dark");

    expect(getPillSelectionColor("dark", colors)).toBe(colors.gray[4]);
  });
});
