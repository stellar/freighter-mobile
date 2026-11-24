import { ThemePreference } from "config/themePreference";
import { getStoredThemePreference } from "helpers/themePreference";
import { create } from "zustand";

interface ThemePreferenceState {
  /** Set through services/themePreference, which also applies and saves it. */
  themePreference: ThemePreference;
}

/**
 * The Preferences theme choice, kept out of the preferences store: components
 * high in the tree subscribe to that whole store (useBiometrics in
 * RootNavigator and every Button), so changing a field there re-renders the
 * app. Not persisted: native storage holds it, because the splash and first
 * render need it before AsyncStorage has loaded.
 */
export const useThemePreferenceStore = create<ThemePreferenceState>()(() => ({
  themePreference: getStoredThemePreference(),
}));
