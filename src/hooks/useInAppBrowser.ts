import { getThemeColors } from "config/colors";
import { useCallback } from "react";
import { Linking, useColorScheme } from "react-native";
import { InAppBrowser } from "react-native-inappbrowser-reborn";

/**
 * Custom hook for opening URLs in an in-app browser with app theme colors
 * Falls back to system browser if InAppBrowser is not available
 */
const useInAppBrowser = () => {
  const colorScheme = useColorScheme();
  const themeColors = getThemeColors(colorScheme ?? "dark");

  const getThemeOptions = useCallback(
    () => ({
      // iOS options
      dismissButtonStyle: "cancel" as const,
      preferredBarTintColor: themeColors.background.primary,
      preferredControlTintColor: themeColors.text.primary,
      readerMode: false,
      animated: true,
      modalPresentationStyle: "fullScreen" as const,
      modalTransitionStyle: "coverVertical" as const,
      modalEnabled: true,
      enableBarCollapsing: false,

      // Android options
      showTitle: true,
      toolbarColor: themeColors.background.primary,
      secondaryToolbarColor: themeColors.background.secondary,
      navigationBarColor: themeColors.background.primary,
      navigationBarDividerColor: themeColors.text.primary,
      enableUrlBarHiding: true,
      enableDefaultShare: true,
      forceCloseOnRedirection: false,

      // Common options
      hasBackButton: true,
      browserPackage: "",
      showInRecents: false,
    }),
    [themeColors],
  );

  /**
   * Check if InAppBrowser is available on the device
   */
  const isAvailable = useCallback(async (): Promise<boolean> => {
    try {
      return await InAppBrowser.isAvailable();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("InAppBrowser availability check failed:", error);
      return false;
    }
  }, []);

  /**
   * Open a URL in the in-app browser with app theme colors
   * Falls back to system browser if InAppBrowser is not available
   * @param url - The URL to open
   * @returns Promise that resolves when the browser is closed
   */
  const open = useCallback(
    async (url: string): Promise<void> => {
      const available = await isAvailable();
      if (!available) {
        Linking.openURL(url);
        return;
      }

      const themeOptions = getThemeOptions();

      try {
        await InAppBrowser.open(url, themeOptions);
      } catch (error) {
        // Fallback to system browser if InAppBrowser fails
        Linking.openURL(url);
      }
    },
    [isAvailable, getThemeOptions],
  );

  return {
    open,
    isAvailable,
  };
};

export { useInAppBrowser };
