import { DefaultTheme } from "@react-navigation/native";
import { NAVIGATION_THEME } from "config/navigationTheme";
import { THEME } from "config/theme";

describe("NAVIGATION_THEME", () => {
  it("uses the app's dark surface as the scene background", () => {
    // React Navigation's Native Stack paints each screen's contentStyle with
    // the theme's `colors.background` by default. If we don't override it, the
    // light DefaultTheme background flashes through during transitions (most
    // visibly as a white flicker at the iOS modal's rounded corners). The
    // navigation theme must therefore match the app's dark surface.
    expect(NAVIGATION_THEME.colors.background).toBe(
      THEME.colors.background.default,
    );
    expect(NAVIGATION_THEME.colors.card).toBe(THEME.colors.background.default);
  });

  it("does not fall back to the light DefaultTheme background", () => {
    expect(NAVIGATION_THEME.colors.background).not.toBe(
      DefaultTheme.colors.background,
    );
    expect(NAVIGATION_THEME.dark).toBe(true);
  });
});
