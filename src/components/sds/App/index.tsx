import { APP_DATA } from "components/sds/App/data";
import { Text } from "components/sds/Typography";
import { useProtocolsStore } from "ducks/protocols";
import { pxValue } from "helpers/dimensions";
import { findMatchedProtocol } from "helpers/protocols";
import useColors from "hooks/useColors";
import React, { useState, useMemo } from "react";
import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";

/**
 * Available sizes for the App component
 * @typedef {"sm" | "md" | "lg" | "xl"} AppSize
 */
export type AppSize = "sm" | "md" | "lg" | "xl";

/**
 * Props for the App component
 * @interface AppProps
 * @property {string} appName - The name of the application
 * @property {AppSize} [size="md"] - The size of the app icon
 * @property {string} [favicon] - Optional URL to the app's favicon (supports PNG and SVG)
 * @property {string} [testID] - Test ID for testing purposes
 */
export interface AppProps {
  appName: string;
  size?: AppSize;
  favicon?: string;
  testID?: string;
}

/**
 * Size mapping for different App component sizes
 * @type {Object.<string, number>}
 * @description Maps size names to pixel values. Uses numbers instead of className
 * because SvgUri does not support className props.
 */
const sizeMap = {
  sm: pxValue(24),
  md: pxValue(32),
  lg: pxValue(40),
  xl: pxValue(48),
  borderRadius: pxValue(8),
};

/**
 * Finds the matching app data key based on the app name
 * @function getAppDataKey
 * @param {string} appName - The name of the application
 * @param {string} [favicon] - Optional favicon URL to match against
 * @returns {string | undefined} The matching app data key or undefined if no match found
 */
const getAppDataKey = (
  appName: string,
  favicon?: string,
): string | undefined => {
  const appDataKey = Object.keys(APP_DATA).find((key) => {
    const appDataName = APP_DATA[key].name.toLowerCase();
    const matchedName = appName.toLowerCase().includes(appDataName);
    const matchedFavicon = favicon?.toLowerCase().includes(appDataName);
    return matchedName || matchedFavicon;
  });
  return appDataKey;
};

/**
 * Component that displays app initials as a fallback when image loading fails
 * @component AppInitials
 * @param {Object} props - Component props
 * @param {string} props.appName - The name of the application
 * @param {string} props.color - The color for the border and text
 * @param {AppSize} props.size - The size of the initials display
 * @param {string} [props.testID] - Test ID for testing purposes
 * @returns {JSX.Element} A circular view containing the first two letters of the app name
 */
const AppInitials: React.FC<{
  appName: string;
  color: string;
  size: AppSize;
  testID?: string;
}> = ({ appName, color, size, testID }) => (
  <View
    testID={testID}
    style={{
      width: sizeMap[size],
      height: sizeMap[size],
      borderWidth: 1,
      borderColor: color,
      borderRadius: sizeMap.borderRadius,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text sm bold color={color}>
      {appName.slice(0, 2)}
    </Text>
  </View>
);

/**
 * App component that displays an application icon with fallback to initials
 * @component App
 * @description
 * This component displays an application icon with the following priority order:
 * 1. Local app data image (if app name/URL matches known apps)
 * 2. Protocol icon (if app name/URL matches known protocols)
 * 3. Provided favicon URL
 * 4. App initials as a fallback when image loading fails
 *
 * The component supports both PNG and SVG images, with automatic format detection.
 * If image loading fails, it gracefully falls back to displaying the first two letters
 * of the app name in a styled container.
 *
 * @param {AppProps} props - Component props
 * @returns {JSX.Element} The rendered app icon or initials
 *
 * @example
 * ```tsx
 * <App appName="MyApp" size="md" favicon="https://example.com/icon.png" />
 * ```
 */
export const App: React.FC<AppProps> = ({
  favicon,
  appName,
  size = "md",
  testID,
}) => {
  const { themeColors } = useColors();
  const { protocols } = useProtocolsStore();
  const [imageError, setImageError] = useState(false);

  // Memoize imageUri calculation for performance
  const imageUri = useMemo(() => {
    // Give priority to the local app data image
    const appDataKey = getAppDataKey(appName, favicon);
    const appData = APP_DATA[appDataKey || ""];
    if (appData) {
      return appData.src;
    }

    // Try to relate with some of the known protocols
    const matchedProtocolSite = findMatchedProtocol({
      protocols,
      searchUrl: favicon,
    });
    if (matchedProtocolSite) {
      return matchedProtocolSite.iconUrl;
    }

    // Fallback to the original favicon url
    return favicon;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appName, favicon, protocols]);

  // If there is an image and no error, render it
  if (imageUri && !imageError) {
    const isSvg = imageUri.toLowerCase().endsWith(".svg");

    return (
      <View
        testID={testID}
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderRadius: sizeMap.borderRadius,
          overflow: "hidden",
        }}
      >
        {isSvg ? (
          <SvgUri
            uri={imageUri}
            width={sizeMap[size]}
            height={sizeMap[size]}
            preserveAspectRatio="xMidYMid meet"
            onError={() => setImageError(true)}
          />
        ) : (
          <Image
            source={{ uri: imageUri }}
            style={{ width: sizeMap[size], height: sizeMap[size] }}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        )}
      </View>
    );
  }

  // Fallback to the app name initials
  return (
    <AppInitials
      appName={appName}
      color={themeColors.text.secondary}
      size={size}
      testID={testID}
    />
  );
};
