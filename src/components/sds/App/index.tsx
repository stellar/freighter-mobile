import { APP_DATA } from "components/sds/App/data";
import { Text } from "components/sds/Typography";
import React, { useState } from "react";
import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";

export type AppSize = "sm" | "md" | "lg" | "xl";

export interface AppProps {
  appName: string;
  size?: AppSize;
  favicon?: string;
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
};

// Check if the app name matches any of the app data keys
const getAppDataKey = (appName: string): string | undefined => {
  const appDataKey = Object.keys(APP_DATA).find((key) =>
    appName.toLowerCase().includes(APP_DATA[key].name.toLowerCase()),
  );
  return appDataKey;
};

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
