import { DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";
import { ColorScheme, getTheme } from "config/theme";

/**
 * Builds the React Navigation theme for the app's top-level
 * `<NavigationContainer>`.
 *
 * Without an explicit theme, React Navigation falls back to its light
 * `DefaultTheme` (background `rgb(242, 242, 242)`). Native Stack uses the
 * theme's `colors.background` as each screen's default `contentStyle`
 * background, so that light native container shows through during transitions
 * — most visibly as a white flicker at the iOS modal's rounded corners while a
 * screen slides in horizontally. Painting the native scene background with the
 * app's own surface removes that flash for every navigator and every screen.
 *
 * The base theme has to match the scheme too: React Navigation reads `dark` to
 * style its own surfaces, so a light scheme built on `DarkTheme` would keep
 * dark headers and card shadows.
 *
 * Prefer the `useNavigationTheme` hook so the theme follows the device.
 *
 * Kept in its own module (rather than `config/theme.ts`) so the design-token
 * file stays free of the React Navigation dependency — `config/theme` is
 * imported by nearly every component, and several component tests replace
 * `@react-navigation/native` with an inline mock that omits `DarkTheme`.
 */
export const getNavigationTheme = (scheme: ColorScheme): Theme => {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const surface = getTheme(scheme).colors.base.primary;

  return {
    ...base,
    colors: {
      ...base.colors,
      background: surface,
      card: surface,
    },
  };
};
