import { ColorScheme, DEFAULT_COLOR_SCHEME } from "config/theme";
import { ThemePreference, coerceThemePreference } from "config/themePreference";
import { Appearance, NativeModules } from "react-native";

interface ThemePreferenceModule {
  initialThemePreference?: string;
  setThemePreference?: (value: ThemePreference) => Promise<string>;
  getSystemColorScheme?: () => Promise<string>;
  beginThemeTransition?: () => Promise<boolean>;
  endThemeTransition?: (durationMs: number) => void;
}

export const THEME_FADE_MS = 250;
// Fade anyway if the new theme hasn't been reported by then.
const THEME_RENDER_TIMEOUT_MS = 500;

const getModule = (): ThemePreferenceModule | undefined =>
  NativeModules.ThemePreference as ThemePreferenceModule | undefined;

/**
 * The saved choice, read synchronously from native storage. Native, not
 * AsyncStorage, because it must be known before the first render and before
 * the splash is drawn (MainApplication / SceneDelegate read the same value).
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

/**
 * The scheme the app ends up showing for a preference. Appearance can't answer
 * this right after a change: setColorScheme applies asynchronously on both
 * platforms, so an immediate read returns the previous scheme. "system" asks
 * native for the device's scheme instead.
 */
export const resolveColorScheme = async (
  preference: ThemePreference,
): Promise<ColorScheme> => {
  if (preference !== "system") {
    return preference;
  }
  try {
    const scheme = await getModule()?.getSystemColorScheme?.();
    if (scheme === "light" || scheme === "dark") {
      return scheme;
    }
  } catch {
    // Fall through to the best available guess.
  }
  return Appearance.getColorScheme() ?? DEFAULT_COLOR_SCHEME;
};

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const waitForColorSchemeChange = (): Promise<void> =>
  new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = Appearance.addChangeListener(() => {
      clearTimeout(timer);
      subscription.remove();
      resolve();
    });
    timer = setTimeout(() => {
      subscription.remove();
      resolve();
    }, THEME_RENDER_TIMEOUT_MS);
  });

/**
 * applyThemePreference with a cross-fade: native freezes the current frame on
 * top, the theme changes underneath, and the frozen frame fades out once the
 * new theme has rendered. Applies without a fade when the scheme won't change
 * (e.g. Auto on a device already in that scheme) or native can't snapshot.
 */
export const applyThemePreferenceWithFade = async (
  preference: ThemePreference,
  // Lets a newer pick win if it lands while this one is waiting.
  isStillWanted: () => boolean = () => true,
): Promise<void> => {
  const themePreferenceModule = getModule();
  const target = await resolveColorScheme(preference);
  if (!isStillWanted()) {
    return;
  }
  if (
    target === Appearance.getColorScheme() ||
    !themePreferenceModule?.beginThemeTransition
  ) {
    applyThemePreference(preference);
    return;
  }

  // Let the picker show the new selection first so the frozen frame has it.
  await nextFrame();
  let isFrozen = false;
  try {
    isFrozen = await themePreferenceModule.beginThemeTransition();
  } catch {
    // Change without the fade.
  }
  if (!isStillWanted()) {
    themePreferenceModule.endThemeTransition?.(0);
    return;
  }
  if (!isFrozen) {
    applyThemePreference(preference);
    return;
  }

  const changed = waitForColorSchemeChange();
  applyThemePreference(preference);
  await changed;
  // The change event triggers the re-render; give it two frames to reach the
  // screen before revealing it.
  await nextFrame();
  await nextFrame();
  themePreferenceModule.endThemeTransition?.(THEME_FADE_MS);
};
