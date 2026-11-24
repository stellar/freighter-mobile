/**
 * The user's theme choice from Preferences. "system" follows the device's
 * color scheme; "light" and "dark" pin the theme. Same values as the
 * extension, so both report the same `preferred_theme`.
 */
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === "string" &&
  (THEME_PREFERENCES as readonly string[]).includes(value);

export const coerceThemePreference = (value: unknown): ThemePreference =>
  isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
