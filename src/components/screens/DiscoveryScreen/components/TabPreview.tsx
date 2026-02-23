import { App } from "components/sds/App";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { getFaviconUrl, isHomepageUrl } from "helpers/browser";
import { getHostname } from "helpers/protocols";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View, Image, TouchableOpacity } from "react-native";

interface TabPreviewProps {
  title: string;
  url: string;
  logoUrl?: string;
  screenshot?: string;
  isActive?: boolean;
  onClose: () => void;
}

// Memoize to avoid unnecessary expensive re-renders
const TabPreview: React.FC<TabPreviewProps> = React.memo(
  ({ title, url, logoUrl, screenshot, isActive = false, onClose }) => {
    const { themeColors } = useColors();

    const domain = useMemo(() => getHostname(url), [url]);

    const renderPreviewContent = useMemo(() => {
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

      // Show homepage preview with Home icon and title
      if (isHomepageUrl(url)) {
        return (
          <View className="w-full h-full bg-background-primary justify-center items-center gap-2">
            <Icon.Home01 size={32} color={themeColors.text.primary} />
            <Text xs semiBold>
              {title}
            </Text>
          </View>
        );
      }

      // Show preview with centered site logo and domain name
      return (
        <View className="w-full h-full bg-background-primary justify-center items-center">
          <App
            appName={title}
            favicon={logoUrl || getFaviconUrl(url)}
            size="lg"
          />
          <View className="mt-2">
            <Text xs semiBold>
              {domain}
            </Text>
          </View>
        </View>
      );
    }, [screenshot, title, logoUrl, url, domain, themeColors.text.primary]);

    return (
      <View
        className={`w-full h-full rounded-[16px] bg-background-secondary overflow-hidden relative ${
          isActive ? "border-[2px] border-primary" : ""
        }`}
      >
        {renderPreviewContent}

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full border-[1px] border-border-primary bg-background-primary justify-center items-center"
        >
          <Icon.X
            size={BROWSER_CONSTANTS.TAB_PREVIEW_CLOSE_ICON_SIZE}
            themeColor="gray"
          />
        </TouchableOpacity>
      </View>
    );
  },
);

TabPreview.displayName = "TabPreview";

export default TabPreview;
