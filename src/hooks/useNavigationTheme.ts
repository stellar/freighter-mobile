import { Theme } from "@react-navigation/native";
import { getNavigationTheme } from "config/navigationTheme";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * This hook is used to get the React Navigation theme for the current color
 * scheme, so the native scene background follows the device.
 *
 * @returns {Theme} The navigation theme for the current color scheme.
 */
const useNavigationTheme = (): Theme => {
  const colorScheme = useColorScheme();

  return useMemo(
    () => getNavigationTheme(colorScheme ?? DEFAULT_COLOR_SCHEME),
    [colorScheme],
  );
};

export default useNavigationTheme;
