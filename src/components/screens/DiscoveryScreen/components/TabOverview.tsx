import HomepagePreview from "components/screens/DiscoveryScreen/HomepagePreview";
import TabPreview from "components/screens/DiscoveryScreen/TabPreview";
import TabScreenshotCapture from "components/screens/DiscoveryScreen/TabScreenshotCapture";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
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

interface TabOverviewProps {
  fadeAnim: Animated.Value;
  onClose: () => void;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onScreenshotCaptured: (tabId: string, screenshot: string) => void;
}

const TabOverview: React.FC<TabOverviewProps> = ({
  fadeAnim,
  onClose,
  onNewTab,
  onSwitchTab,
  onCloseTab,
  onScreenshotCaptured,
}) => {
  const { themeColors } = useColors();
  const { tabs, isTabActive } = useBrowserTabsStore();

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: fadeAnim,
        backgroundColor: themeColors.background.primary,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border-default">
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
                  if (tab.screenshot) {
                    return (
                      <Image
                        source={{ uri: tab.screenshot }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onError={() => {
                          // Remove the screenshot if it fails to load
                          // This would need to be handled by the parent component
                        }}
                      />
                    );
                  }

                  if (isHomepageUrl(tab.url)) {
                    return <HomepagePreview tabId={tab.id} />;
                  }

                  return <TabPreview url={tab.url} logoUrl={tab.logoUrl} />;
                })()}

                {/* Close button */}
                {tabs.length > 1 && (
                  <TouchableOpacity
                    onPress={() => onCloseTab(tab.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 justify-center items-center"
                  >
                    <Icon.X size={12} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Hidden WebViews for capturing screenshots */}
      {tabs.map(
        (tab) =>
          !isHomepageUrl(tab.url) && (
            <TabScreenshotCapture
              key={`screenshot-${tab.id}`}
              tabId={tab.id}
              url={tab.url}
              isVisible={!tab.screenshot}
              onScreenshotCaptured={(screenshot) => {
                onScreenshotCaptured(tab.id, screenshot);
              }}
            />
          ),
      )}
    </Animated.View>
  );
};

export default TabOverview;
