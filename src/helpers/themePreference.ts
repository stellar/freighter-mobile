import { ThemePreference, coerceThemePreference } from "config/themePreference";
import { Appearance, NativeModules } from "react-native";

interface ThemePreferenceModule {
  initialThemePreference?: string;
  setThemePreference?: (value: ThemePreference) => Promise<string>;
}

const getModule = (): ThemePreferenceModule | undefined =>
  NativeModules.ThemePreference as ThemePreferenceModule | undefined;

/**
 * The saved choice, read synchronously from native storage. Native, not
 * AsyncStorage, because it must be known before the first render and before
 * the splash is drawn (MainActivity / SceneDelegate read the same value).
 * Unknown or missing values fall back to "system".
 */
export const getStoredThemePreference = (): ThemePreference =>
  coerceThemePreference(getModule()?.initialThemePreference);

/**
 * Points every useColorScheme() reader at the preference, along with native UI
 * (status bar, keyboard, alerts). "system" (null) follows the device again,
 * including live changes.
 */
export const applyThemePreference = (preference: ThemePreference): void => {
  Appearance.setColorScheme(preference === "system" ? null : preference);
};

/** Persists the choice natively. Throws if the write fails. */
export const saveThemePreference = async (
  preference: ThemePreference,
): Promise<void> => {
  const themePreferenceModule = getModule();
  if (!themePreferenceModule?.setThemePreference) {
    throw new Error("ThemePreference native module is unavailable");
  }
  await themePreferenceModule.setThemePreference(preference);
};
