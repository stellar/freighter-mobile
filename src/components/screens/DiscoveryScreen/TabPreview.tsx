import HomepagePreview from "components/screens/DiscoveryScreen/HomepagePreview";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import {
  getDomainFromUrl,
  getFaviconUrl,
  isHomepageUrl,
} from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useState, useEffect } from "react";
import { View, Image, TouchableOpacity } from "react-native";

interface TabPreviewProps {
  url: string;
  logoUrl?: string;
  screenshot?: string;
  isActive?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
}

const TabPreview: React.FC<TabPreviewProps> = ({
  url,
  logoUrl,
  screenshot,
  isActive = false,
  showCloseButton = false,
  onClose,
}) => {
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

  const renderPreviewContent = () => {
    // Show homepage simplified preview if URL is homepage
    if (isHomepageUrl(url)) {
      return <HomepagePreview />;
    }

    // Show screenshot if available
    if (screenshot) {
      return (
        <Image
          source={{ uri: screenshot }}
          className="w-full h-full"
          resizeMode="cover"
          onError={(error) => {
            logger.error("TabPreview", "Failed to load screenshot:", error);
          }}
        />
      );
    }

    // Show preview with centered logo and domain name
    return (
      <View className="w-full h-full bg-background-primary justify-center items-center">
        {faviconUrl && !faviconError ? (
          <Image
            source={{ uri: faviconUrl }}
            style={{
              width: pxValue(BROWSER_CONSTANTS.TAB_PREVIEW_FAVICON_SIZE),
              height: pxValue(BROWSER_CONSTANTS.TAB_PREVIEW_FAVICON_SIZE),
            }}
            onError={() => setFaviconError(true)}
            resizeMode="contain"
          />
        ) : (
          <Icon.Globe02
            size={pxValue(BROWSER_CONSTANTS.TAB_PREVIEW_FAVICON_SIZE)}
            color={themeColors.text.primary}
            circle
          />
        )}
        <View className="mt-2">
          <Text xs semiBold>
            {domain}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View
      className={`w-full h-full rounded-lg bg-background-secondary overflow-hidden relative ${
        isActive ? "border-2 border-primary" : "border border-border-default"
      }`}
    >
      {renderPreviewContent()}

      {/* Close button */}
      {showCloseButton && (
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background-tertiary justify-center items-center"
        >
          <Icon.X
            size={pxValue(BROWSER_CONSTANTS.TAB_PREVIEW_CLOSE_ICON_SIZE)}
            color={themeColors.base[1]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default TabPreview;
