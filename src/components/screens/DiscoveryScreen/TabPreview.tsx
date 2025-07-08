import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { getDomainFromUrl, getFaviconUrl } from "helpers/browser";
import useColors from "hooks/useColors";
import React, { useState, useEffect } from "react";
import { View, Image } from "react-native";

interface TabPreviewProps {
  url: string;
  logoUrl?: string;
}

const TabPreview: React.FC<TabPreviewProps> = ({ url, logoUrl }) => {
  const { themeColors } = useColors();
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);

  useEffect(() => {
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

  return (
    <View className="w-full h-full bg-background-primary justify-center items-center">
      {faviconUrl && !faviconError ? (
        <Image
          source={{ uri: faviconUrl }}
          style={{ width: 32, height: 32 }}
          onError={() => setFaviconError(true)}
          resizeMode="contain"
        />
      ) : (
        <Icon.Globe02 size={32} color={themeColors.text.primary} circle />
      )}
      <View className="mt-2">
        <Text xs semiBold>
          {domain}
        </Text>
      </View>
    </View>
  );
};

export default TabPreview;
