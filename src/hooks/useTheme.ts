import { DEFAULT_COLOR_SCHEME, Theme, getTheme } from "config/theme";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * This hook is used to get the semantic theme for the current color scheme.
 * It uses the useColorScheme hook to get the current theme and returns the
 * theme built from the matching palette.
 *
 * @returns {Theme} The theme for the current color scheme.
 *
 * @example
 * const theme = useTheme();
 * console.log(theme.colors.background.default, theme.colors.text.primary);
 */
const useTheme = (): Theme => {
  const colorScheme = useColorScheme();

  return useMemo(
    () => getTheme(colorScheme ?? DEFAULT_COLOR_SCHEME),
    [colorScheme],
  );
};

export default useTheme;
