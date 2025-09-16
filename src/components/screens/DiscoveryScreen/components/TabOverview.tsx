import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { TabPreview } from "components/screens/DiscoveryScreen/components";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  BROWSER_CONSTANTS,
  DEFAULT_PADDING,
  DEFAULT_PRESS_DELAY,
} from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity, FlatList } from "react-native";

interface TabOverviewHeaderProps {
  tabsCount: number;
  onClose: () => void;
  onNewTab: () => void;
}

const TabOverviewHeader: React.FC<TabOverviewHeaderProps> = ({
  tabsCount,
  onClose,
  onNewTab,
}) => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-row items-center justify-between px-6 py-4">
      <CustomHeaderButton position="left" icon={Icon.X} onPress={onClose} />
      <Text lg semiBold>
        {tabsCount > 1
          ? t("discovery.tabs", { count: tabsCount })
          : t("discovery.oneTab")}
      </Text>
      <CustomHeaderButton
        position="right"
        icon={Icon.Plus}
        onPress={onNewTab}
      />
    </View>
  );
};

interface TabOverviewProps {
  onClose: () => void;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseAllTabs: () => void;
  newTabId?: string | null;
}

// Memoize to avoid unnecessary expensive re-renders
const TabOverview: React.FC<TabOverviewProps> = React.memo(
  ({
    onClose,
    onNewTab,
    onSwitchTab,
    onCloseTab,
    onCloseAllTabs,
    newTabId,
  }) => {
    const { tabs, isTabActive } = useBrowserTabsStore();
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    // Filter out the specific new tab being added to prevent showing
    // its preview while it's being added so we have a smoother UI transition
    const displayTabs = newTabId
      ? tabs.filter((tab) => tab.id !== newTabId)
      : tabs;

    // Check if we should show the "Close all tabs" button
    // Hide it if there's only 1 tab and it's the homepage
    const shouldShowCloseAllButton =
      tabs.length > 1 || (tabs.length === 1 && !isHomepageUrl(tabs[0]?.url));

    return (
      <View className="relative flex-1">
        <TabOverviewHeader
          tabsCount={tabs.length}
          onClose={onClose}
          onNewTab={onNewTab}
        />

        {/* Tabs Grid */}
        <FlatList
          data={displayTabs}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: pxValue(16),
          }}
          ListFooterComponent={
            shouldShowCloseAllButton ? (
              <View className="mx-auto mt-3 mb-1">
                <Button
                  secondary
                  icon={
                    <Icon.XCircle
                      color={themeColors.foreground.primary}
                      size={18}
                    />
                  }
                  onPress={onCloseAllTabs}
                >
                  {t("discovery.closeAllTabs")}
                </Button>
              </View>
            ) : null
          }
          contentContainerStyle={{ padding: pxValue(DEFAULT_PADDING) }}
          keyExtractor={(tab) => tab.id}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onSwitchTab(tab.id)}
              delayPressIn={DEFAULT_PRESS_DELAY}
              className={BROWSER_CONSTANTS.TAB_PREVIEW_TILE_SIZE}
            >
              <TabPreview
                title={tab.title}
                url={tab.url}
                logoUrl={tab.logoUrl}
                screenshot={tab.screenshot}
                isActive={isTabActive(tab.id)}
                onClose={() => onCloseTab(tab.id)}
              />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          // Remove clipped subviews to improve performance
          removeClippedSubviews
          // Rendering 10 items at a time to improve performance
          maxToRenderPerBatch={10}
          // Reduced out-of-bounds window size to improve performance (default is 21)
          windowSize={5}
        />
      </View>
    );
  },
);

TabOverview.displayName = "TabOverview";

export default TabOverview;
