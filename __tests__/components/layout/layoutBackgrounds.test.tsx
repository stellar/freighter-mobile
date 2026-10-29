import { BaseLayout } from "components/layout/BaseLayout";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { ScrollableKeyboardView } from "components/layout/ScrollableKeyboardView";
import { Text } from "components/sds/Typography";
import { getTheme } from "config/theme";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";

// Figma paints the page with Colors/Base/0 (#ffffff / #000000), not with
// Default/Background/Primary (#fcfcfc / #161616), which is for the surfaces
// that sit on top of a page. See the Varial welcome screen:
// light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=650-6360
// dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-37023
const DARK_SURFACE = getTheme("dark").colors.base.primary;
const LIGHT_SURFACE = getTheme("light").colors.base.primary;

/**
 * Collects every backgroundColor in a rendered tree. Asserting on these rather
 * than on a testID keeps the test independent of how each layout nests its
 * containers, and none of these layouts needs a test-only prop to be checked.
 */
const backgroundColors = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(backgroundColors);
  if (!node || typeof node !== "object") return [];

  const el = node as { props?: Record<string, unknown>; children?: unknown };
  const style = el.props?.style;
  const styles = (Array.isArray(style) ? style : [style]).filter(Boolean) as {
    backgroundColor?: string;
  }[];
  const own = styles
    .map((s) => s.backgroundColor)
    .filter((c): c is string => typeof c === "string");

  return [...own, ...backgroundColors(el.children)];
};

const layouts = [
  {
    name: "BaseLayout",
    render: () => (
      <BaseLayout>
        <Text>content</Text>
      </BaseLayout>
    ),
  },
  {
    name: "ScrollableKeyboardView",
    render: () => (
      <ScrollableKeyboardView>
        <Text>content</Text>
      </ScrollableKeyboardView>
    ),
  },
  {
    name: "OnboardLayout",
    render: () => (
      <OnboardLayout title="Title">
        <Text>content</Text>
      </OnboardLayout>
    ),
  },
];

describe("layout surfaces follow the color scheme", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  layouts.forEach(({ name, render }) => {
    it(`${name} paints the dark surface on a dark device`, () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");

      const colors = backgroundColors(renderWithProviders(render()).toJSON());

      expect(colors).toContain(DARK_SURFACE);
    });

    it(`${name} drops the dark surface on a light device`, () => {
      // Asserting the dark surface is absent rather than the light one is
      // present: the light surface shares its value with a Button variant, so
      // a positive check would pass even while the layout stayed pinned dark.
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");

      const colors = backgroundColors(renderWithProviders(render()).toJSON());

      expect(colors).not.toContain(DARK_SURFACE);
      expect(colors).toContain(LIGHT_SURFACE);
    });
  });
});
