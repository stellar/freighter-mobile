import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React, { useState, useEffect } from "react";
import { View, Image } from "react-native";

interface TabPreviewProps {
  url: string;
  title: string;
  isActive: boolean;
  logoUrl?: string;
}

const TabPreview: React.FC<TabPreviewProps> = ({
  url,
  title,
  isActive,
  logoUrl,
}) => {
  const { themeColors } = useColors();
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);

  // Helper function to extract domain from URL
  const getDomainFromUrl = (urlInput: string): string => {
    try {
      const urlObj = new URL(urlInput);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "Unknown";
    }
  };

  // Helper function to get favicon URL
  const getFaviconUrl = (urlInput: string): string => {
    try {
      const urlObj = new URL(urlInput);
      return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    } catch {
      return "";
    }
  };

  useEffect(() => {
    // Skip favicon for homepage
    if (url === "freighter://homepage") {
      setFaviconUrl(null);
      return;
    }

    // Use logoUrl from store if available, otherwise try to get favicon
    if (logoUrl) {
      setFaviconUrl(logoUrl);
    } else {
      const favicon = getFaviconUrl(url);
      if (favicon) {
        setFaviconUrl(favicon);
      }
    }
  }, [url, logoUrl]);

  const domain = getDomainFromUrl(url);
  const displayTitle = title && title !== "New Tab" ? title : domain;

  return (
    <View className="h-32 bg-background-secondary justify-center items-center overflow-hidden relative">
      {/* Background gradient */}
      <View className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100" />

      {/* Header bar simulation */}
      <View className="absolute top-0 left-0 right-0 h-8 bg-white border-b border-gray-200" />

      {/* Content area */}
      <View className="flex-1 w-full px-4 pt-10 pb-4">
        {/* Favicon and title row */}
        <View className="flex-row items-center mb-2">
          {faviconUrl && !faviconError ? (
            <Image
              source={{ uri: faviconUrl }}
              className="w-4 h-4 mr-2"
              onError={() => setFaviconError(true)}
              resizeMode="contain"
            />
          ) : (
            <View className="mr-2">
              <Icon.Globe02 size={16} color={themeColors.text.secondary} />
            </View>
          )}
          <Text xs semiBold numberOfLines={1} className="flex-1">
            {displayTitle}
          </Text>
        </View>

        {/* Content lines simulation */}
        <View className="space-y-1">
          <View className="h-2 bg-gray-200 rounded" style={{ width: "80%" }} />
          <View className="h-2 bg-gray-200 rounded" style={{ width: "60%" }} />
          <View className="h-2 bg-gray-200 rounded" style={{ width: "90%" }} />
        </View>
      </View>

      {/* Active tab indicator */}
      {isActive && (
        <View className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary" />
      )}
    </View>
  );
};

export default TabPreview;
