import { getThemeColors } from "config/colors";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { useCallback } from "react";
import { Linking, useColorScheme } from "react-native";
import { InAppBrowser } from "react-native-inappbrowser-reborn";

/**
 * Custom hook for opening URLs in an in-app browser with app theme colors
 * Falls back to system browser if InAppBrowser is not available
 */
const useInAppBrowser = () => {
  const colorScheme = useColorScheme();
  const themeColors = getThemeColors(colorScheme ?? DEFAULT_COLOR_SCHEME);

  const getThemeOptions = useCallback(
    () => ({
      // iOS options
      //
      // No preferredBarTintColor / preferredControlTintColor on purpose.
      // SFSafariViewController renders out of process, so the app cannot see
      // the page it is showing, while Safari tints its own bars from that
      // page's rendered background. Naming a color here overrides that and
      // paints the app's background above a site that may be the opposite
      // brightness -- a light page under a dark bar, or the reverse, depending
      // on the device. Leaving both unset is what lets the chrome follow the
      // site the way it does in Safari.
      dismissButtonStyle: "cancel" as const,
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
        throw error;
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
