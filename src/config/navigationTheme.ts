import { DarkTheme, Theme } from "@react-navigation/native";
import { THEME } from "config/theme";

/**
 * React Navigation theme for the app's top-level `<NavigationContainer>`.
 *
 * Without an explicit theme, React Navigation falls back to its light
 * `DefaultTheme` (background `rgb(242, 242, 242)`). Native Stack uses the
 * theme's `colors.background` as each screen's default `contentStyle`
 * background, so that light native container shows through during transitions
 * — most visibly as a white flicker at the iOS modal's rounded corners while a
 * screen slides in horizontally. Painting the native scene background with the
 * app's dark surface removes that flash for every navigator and every screen.
 *
 * The app forces dark mode (see `App.tsx`), so this extends `DarkTheme` and
 * overrides the surface colors with the app's own background token.
 *
 * Kept in its own module (rather than `config/theme.ts`) so the design-token
 * file stays free of the React Navigation dependency — `config/theme` is
 * imported by nearly every component, and several component tests replace
 * `@react-navigation/native` with an inline mock that omits `DarkTheme`.
 */
export const NAVIGATION_THEME: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: THEME.colors.background.default,
    card: THEME.colors.background.default,
  },
};
