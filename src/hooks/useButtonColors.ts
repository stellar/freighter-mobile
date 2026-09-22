import { ButtonColors, getButtonColors } from "components/sds/Button/theme";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * This hook is used to get the Button colors for the current color scheme.
 *
 * @returns {ButtonColors} The button colors for the current color scheme.
 */
const useButtonColors = (): ButtonColors => {
  const colorScheme = useColorScheme();

  return useMemo(
    () => getButtonColors(colorScheme ?? DEFAULT_COLOR_SCHEME),
    [colorScheme],
  );
};

export default useButtonColors;
