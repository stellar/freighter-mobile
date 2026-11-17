import { AnalyticsEvent } from "config/analyticsConfig";
import { ColorScheme } from "config/theme";
import { ThemePreference } from "config/themePreference";
import { track } from "services/analytics/core";

/**
 * A pick in the Preferences theme picker. `colorScheme` is the scheme that
 * pick produced, recorded before its save finished: a quicker second pick
 * can change the screen by then, and the common context would report that.
 */
export const trackThemeChanged = ({
  preference,
  previous,
  colorScheme,
}: {
  preference: ThemePreference;
  previous: ThemePreference;
  colorScheme: ColorScheme;
}): void => {
  track(AnalyticsEvent.THEME_CHANGED, {
    preferred_theme: preference,
    previous_preferred_theme: previous,
    color_scheme: colorScheme,
  });
};
