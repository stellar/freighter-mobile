import HomepagePreview from "components/screens/DiscoveryScreen/HomepagePreview";
import TabPreview from "components/screens/DiscoveryScreen/TabPreview";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import useColors from "hooks/useColors";
import React from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";

interface TabOverviewProps {
  fadeAnim: Animated.Value;
  onClose: () => void;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  insets: EdgeInsets;
}

const TabOverview: React.FC<TabOverviewProps> = ({
  fadeAnim,
  onClose,
  onNewTab,
  onSwitchTab,
  onCloseTab,
  insets,
}) => {
  const { themeColors } = useColors();
  const { tabs, isTabActive } = useBrowserTabsStore();

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        opacity: fadeAnim,
        backgroundColor: themeColors.background.primary,
      }}
    >
      {/* Header */}
      {/* TODO: use a custom header component instead */}
      <View
        className="flex-row items-center justify-between p-4 border-b border-border-default"
        style={{ paddingTop: insets.top + 16 }}
      >
        <TouchableOpacity onPress={onClose}>
          <Icon.X color={themeColors.base[1]} />
        </TouchableOpacity>
        <Text lg semiBold>
          {tabs.length} Tab{tabs.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity onPress={onNewTab}>
          <Icon.Plus color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>

      {/* Tabs Grid */}
      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap justify-between">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onSwitchTab(tab.id)}
              className={`w-[48%] mb-4 rounded-lg overflow-hidden ${
                isTabActive(tab.id)
                  ? "border-2 border-primary"
                  : "border border-border-default"
              }`}
            >
              {/* Tab Preview */}
              <View className="h-64 bg-background-secondary justify-center items-center overflow-hidden relative">
                {(() => {
                  // Show screenshot if available
                  if (tab.screenshot) {
                    return (
                      <Image
                        source={{ uri: tab.screenshot }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onError={(error) => {
                          logger.error(
                            "TabOverview",
                            "Failed to load screenshot:",
                            error,
                          );
                        }}
                      />
                    );
                  }

                  // Show homepage simplified preview if URL is homepage
                  if (isHomepageUrl(tab.url)) {
                    return <HomepagePreview />;
                  }

                  // Show preview with centered logo and domain name
                  return <TabPreview url={tab.url} logoUrl={tab.logoUrl} />;
                })()}

                {/* Close button */}
                {tabs.length > 1 && (
                  <TouchableOpacity
                    onPress={() => onCloseTab(tab.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background-tertiary justify-center items-center"
                  >
                    <Icon.X size={12} color={themeColors.base[1]} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
};

export default TabOverview;
