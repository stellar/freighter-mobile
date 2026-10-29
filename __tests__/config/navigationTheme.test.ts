import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { renderHook } from "@testing-library/react-hooks";
import { getNavigationTheme } from "config/navigationTheme";
import { getTheme } from "config/theme";
import useNavigationTheme from "hooks/useNavigationTheme";
import * as RN from "react-native";

describe("getNavigationTheme", () => {
  it("paints the scene background with the app's surface for each scheme", () => {
    // React Navigation's Native Stack paints each screen's contentStyle with
    // the theme's `colors.background` by default. If we don't override it, the
    // light DefaultTheme background flashes through during transitions (most
    // visibly as a white flicker at the iOS modal's rounded corners). The
    // navigation theme must therefore match the app's own page color.
    (["light", "dark"] as const).forEach((scheme) => {
      const surface = getTheme(scheme).colors.base.primary;

      expect(getNavigationTheme(scheme).colors.background).toBe(surface);
      expect(getNavigationTheme(scheme).colors.card).toBe(surface);
    });
  });

  it("never falls back to React Navigation's DefaultTheme background", () => {
    expect(getNavigationTheme("dark").colors.background).not.toBe(
      DefaultTheme.colors.background,
    );
    expect(getNavigationTheme("light").colors.background).not.toBe(
      DefaultTheme.colors.background,
    );
  });

  it("marks the theme dark only for the dark scheme", () => {
    // React Navigation reads `dark` to style its own surfaces, so a light
    // scheme built on DarkTheme would keep dark headers and card shadows.
    expect(getNavigationTheme("dark").dark).toBe(true);
    expect(getNavigationTheme("light").dark).toBe(false);
  });

  it("keeps the remaining palette from the matching base theme", () => {
    expect(getNavigationTheme("dark").colors.notification).toBe(
      DarkTheme.colors.notification,
    );
    expect(getNavigationTheme("light").colors.notification).toBe(
      DefaultTheme.colors.notification,
    );
  });
});

describe("useNavigationTheme", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("follows the device color scheme", () => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");

    const { result } = renderHook(() => useNavigationTheme());

    expect(result.current).toEqual(getNavigationTheme("dark"));
  });
});
