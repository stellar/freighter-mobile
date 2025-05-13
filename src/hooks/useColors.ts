import { getThemeColors } from "config/colors";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

export type ThemeColors = ReturnType<typeof getThemeColors>;

interface UseColorsResponse {
  themeColors: ThemeColors;
}

/**
 * This hook is used to get the colors for the current theme.
 * It uses the useColorScheme hook to get the current theme and returns the colors for the current theme.
 * @returns {Object} The colors for the current theme.
 *
 * @example
 * const { themeColors } = useColors();
 * console.log(themeColors.base[1], themeColors.foreground.primary, themeColors.gray[9]);
 */
const useColors = (): UseColorsResponse => {
  const colorScheme = useColorScheme();

  const themeColors = useMemo(
    () => getThemeColors(colorScheme ?? "dark"),
    [colorScheme],
  );

  return {
    themeColors,
  };
};

export default useColors;
