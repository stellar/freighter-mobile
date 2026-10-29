import {
  DEFAULT_COLOR_SCHEME,
  NotificationVariants,
  getNotificationVariants,
} from "config/theme";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * This hook is used to get the notification variant colors for the current
 * color scheme.
 *
 * @returns {NotificationVariants} The variant colors for the current theme.
 *
 * @example
 * const variants = useNotificationVariants();
 * console.log(variants.success.backgroundColor, variants.error.iconColor);
 */
const useNotificationVariants = (): NotificationVariants => {
  const colorScheme = useColorScheme();

  return useMemo(
    () => getNotificationVariants(colorScheme ?? DEFAULT_COLOR_SCHEME),
    [colorScheme],
  );
};

export default useNotificationVariants;
