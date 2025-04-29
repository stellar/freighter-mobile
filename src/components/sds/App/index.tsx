import { APP_DATA } from "components/sds/App/data";
import { Text } from "components/sds/Typography";
import React from "react";
import { Image, View } from "react-native";

export type AppSize = "sm" | "md" | "lg" | "xl";

export interface AppProps {
  appName: string;
  size?: AppSize;
  faviconUrl?: string;
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

export const App: React.FC<AppProps> = ({
  faviconUrl,
  appName,
  size = "md",
}) => {
  let imageUri = faviconUrl;

  const appDataKey = getAppDataKey(appName);

  const appData = APP_DATA[appDataKey || ""];
  if (appData) {
    imageUri = appData.src;
  }

  if (imageUri) {
    return (
      <View className={`${sizeMap[size]} rounded-lg overflow-hidden`}>
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full"
            resizeMode="contain"
          />
        )}
      </View>
    );
  }

  return (
    <View
      className={`${sizeMap[size]} border border-foreground-primary rounded-full items-center justify-center`}
    >
      <Text sm bold secondary>
        {appName.slice(0, 2)}
      </Text>
    </View>
  );
};
