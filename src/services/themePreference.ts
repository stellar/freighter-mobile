import { ColorScheme, DEFAULT_COLOR_SCHEME } from "config/theme";
import { ThemePreference } from "config/themePreference";
import { usePreferencesStore } from "ducks/preferences";
import {
  applyThemePreference,
  saveThemePreference,
} from "helpers/themePreference";
import { Appearance } from "react-native";
import { analytics } from "services/analytics";
import { syncPreferredThemeTrait } from "services/analytics/core";

const getColorScheme = (): ColorScheme =>
  Appearance.getColorScheme() ?? DEFAULT_COLOR_SCHEME;

/**
 * Handles a pick in the Preferences theme picker: applies it immediately,
 * persists it natively, then reports it. Throws if the save fails, in which
 * case nothing is reported.
 */
export const selectThemePreference = async (
  preference: ThemePreference,
): Promise<void> => {
  const previous = usePreferencesStore.getState().themePreference;
  if (preference === previous) {
    return;
  }
  usePreferencesStore.setState({ themePreference: preference });
  applyThemePreference(preference);
  // Captured now: a quicker second pick can change the screen before this
  // save resolves.
  const colorScheme = getColorScheme();

  await saveThemePreference(preference);

  analytics.trackThemeChanged({ preference, previous, colorScheme });
  // A newer pick reports its own value; an older save finishing later must
  // not overwrite it.
  if (preference === usePreferencesStore.getState().themePreference) {
    syncPreferredThemeTrait(preference, { force: true });
  }
};
