import { ThemePreference } from "config/themePreference";
import { usePreferencesStore } from "ducks/preferences";
import {
  applyThemePreference,
  resolveColorScheme,
  saveThemePreference,
} from "helpers/themePreference";
import { analytics } from "services/analytics";
import { syncPreferredThemeTrait } from "services/analytics/core";

// Picks are numbered so a save that settles late can tell whether a newer pick
// has happened since.
let latestPick = 0;
let lastSavedPick = 0;
let lastFailedPick = 0;
// What native storage holds, as far as JS knows. Unset until the first pick,
// when the store still holds the value read from native at startup.
let lastSavedPreference: ThemePreference | undefined;

const showPreference = (preference: ThemePreference): void => {
  usePreferencesStore.setState({ themePreference: preference });
  applyThemePreference(preference);
};

/**
 * Handles a pick in the Preferences theme picker: applies it immediately,
 * persists it natively, then reports it. If the newest pick fails to save, the
 * screen goes back to what is saved, so it never shows a choice that would be
 * lost on relaunch; the error is rethrown and nothing is reported.
 */
export const selectThemePreference = async (
  preference: ThemePreference,
): Promise<void> => {
  const previous = usePreferencesStore.getState().themePreference;
  if (preference === previous) {
    return;
  }
  lastSavedPreference ??= previous;
  latestPick += 1;
  const pick = latestPick;

  showPreference(preference);

  try {
    await saveThemePreference(preference);
  } catch (error) {
    lastFailedPick = pick;
    const saved = lastSavedPreference;
    if (pick === latestPick && saved) {
      showPreference(saved);
      syncPreferredThemeTrait(saved);
    }
    throw error;
  }

  if (pick > lastSavedPick) {
    lastSavedPick = pick;
    lastSavedPreference = preference;
    // The newest pick already failed and fell back to an older saved value;
    // this save landed after it, so storage now holds this one.
    if (lastFailedPick === latestPick) {
      showPreference(preference);
    }
  }

  const colorScheme = await resolveColorScheme(preference);
  analytics.trackThemeChanged({ preference, previous, colorScheme });
  // A newer pick reports its own value; an older save finishing later must
  // not overwrite it.
  if (preference === usePreferencesStore.getState().themePreference) {
    syncPreferredThemeTrait(preference, { force: true });
  }
};
