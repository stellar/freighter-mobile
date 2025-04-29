import { APP_DATA } from "components/sds/App/data";
import { Text } from "components/sds/Typography";
import React, { useState } from "react";
import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";

/**
 * Available sizes for the App component
 * @typedef {Object} AppSize
 * @property {string} sm - Small size (24x24)
 * @property {string} md - Medium size (32x32)
 * @property {string} lg - Large size (40x40)
 * @property {string} xl - Extra large size (48x48)
 */
export type AppSize = "sm" | "md" | "lg" | "xl";

/**
 * Props for the App component
 * @interface AppProps
 * @property {string} appName - The name of the application
 * @property {AppSize} [size="md"] - The size of the app icon
 * @property {string} [favicon] - Optional URL to the app's favicon (supports PNG and SVG)
 */
export interface AppProps {
  appName: string;
  size?: AppSize;
  favicon?: string;
}

/**
 * Size mapping for different App component sizes
 * @constant
 * @type {Record<AppSize, string>}
 */
const sizeMap = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
};

/**
 * Finds the matching app data key based on the app name
 * @function getAppDataKey
 * @param {string} appName - The name of the application
 * @returns {string | undefined} The matching app data key or undefined if no match found
 */
const getAppDataKey = (appName: string): string | undefined => {
  const appDataKey = Object.keys(APP_DATA).find((key) =>
    appName.toLowerCase().includes(APP_DATA[key].name.toLowerCase()),
  );
  return appDataKey;
};

/**
 * Component that displays app initials as a fallback when image loading fails
 * @component AppInitials
 * @param {Object} props - Component props
 * @param {string} props.appName - The name of the application
 * @param {AppSize} props.size - The size of the initials display
 * @returns {JSX.Element} A circular view containing the first two letters of the app name
 */
const AppInitials: React.FC<{ appName: string; size: AppSize }> = ({
  appName,
  size,
}) => (
  <View
    className={`${sizeMap[size]} border border-border-primary rounded-full items-center justify-center`}
  >
    <Text sm bold secondary>
      {appName.slice(0, 2)}
    </Text>
  </View>
);

/**
 * App component that displays an application icon with fallback to initials
 * @component App
 * @description
 * This component displays an application icon that can be either:
 * - A PNG image from a URL
 * - An SVG image from a URL
 * - App initials as a fallback when image loading fails
 *
 * The component prioritizes the app data image if available, otherwise uses the provided favicon.
 * If both image loading fails, it falls back to displaying the first two letters of the app name.
 *
 * @param {AppProps} props - Component props
 * @returns {JSX.Element} The rendered app icon or initials
 *
 * @example
 * ```tsx
 * <App appName="MyApp" size="md" favicon="https://example.com/icon.png" />
 * ```
 */
export const App: React.FC<AppProps> = ({ favicon, appName, size = "md" }) => {
  let imageUri = favicon;
  const [imageError, setImageError] = useState(false);

  // Give priority to the app data image in case it exists
  const appDataKey = getAppDataKey(appName);
  const appData = APP_DATA[appDataKey || ""];
  if (appData) {
    imageUri = appData.src;
  }

  // If there is an image and no error, render it
  if (imageUri && !imageError) {
    const isSvg = imageUri.toLowerCase().endsWith(".svg");

    return (
      <View className={`${sizeMap[size]} rounded-lg overflow-hidden`}>
        {isSvg ? (
          <SvgUri
            uri={imageUri}
            className="w-full h-full"
            onError={() => setImageError(true)}
          />
        ) : (
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full"
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        )}
      </View>
    );
  }

  // Fallback to the app name initials
  return <AppInitials appName={appName} size={size} />;
};
