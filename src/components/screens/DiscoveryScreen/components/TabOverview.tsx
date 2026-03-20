import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { TabPreview } from "components/screens/DiscoveryScreen/components";
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
import React, { useCallback, useMemo } from "react";
import { Platform, View, TouchableOpacity, FlatList } from "react-native";

interface TabOverviewHeaderProps {
  tabsCount: number;
}

const TabOverviewHeader: React.FC<TabOverviewHeaderProps> = ({ tabsCount }) => {
  const { t } = useAppTranslation();

  return (
    <View className="items-center px-6 py-4">
      <Text md medium>
        {tabsCount > 1
          ? t("discovery.tabs", { count: tabsCount })
          : t("discovery.oneTab")}
      </Text>
    </View>
  );
};

interface TabOverviewFooterProps {
  onClose: () => void;
  onNewTab: () => void;
  onCloseActiveTab: () => void;
  onCloseAllTabs: () => void;
  showCloseAllOption: boolean;
}

const TabOverviewFooter: React.FC<TabOverviewFooterProps> = ({
  onClose,
  onNewTab,
  onCloseActiveTab,
  onCloseAllTabs,
  showCloseAllOption,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const contextMenuActions: MenuItem[] = useMemo(() => {
    const actions: MenuItem[] = [
      {
        title: t("discovery.closeThisTab"),
        systemIcon: Platform.select({
          ios: "xmark.circle",
          android: "close",
        }),
        onPress: onCloseActiveTab,
      },
    ];

    if (showCloseAllOption) {
      actions.push({
        title: t("discovery.closeAllTabs"),
        systemIcon: Platform.select({
          ios: "xmark.circle.fill",
          android: "close",
        }),
        onPress: onCloseAllTabs,
        destructive: true,
      });
    }

    return actions;
  }, [t, onCloseActiveTab, onCloseAllTabs, showCloseAllOption]);

  return (
    <View className="flex-row items-center border-t border-border-primary bg-background-primary px-6 py-4">
      <View className="flex-1 items-start">
        <ContextMenuButton
          contextMenuProps={{ actions: contextMenuActions }}
          side="top"
          align="start"
          sideOffset={8}
        >
          <Icon.DotsHorizontal size={24} color={themeColors.base[1]} />
        </ContextMenuButton>
      </View>

      <TouchableOpacity
        onPress={onNewTab}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="size-[40px] justify-center items-center"
      >
        <Icon.Plus size={24} color={themeColors.base[1]} />
      </TouchableOpacity>

      <View className="flex-1 items-end">
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text md medium>
            {t("common.done")}
          </Text>
        </TouchableOpacity>
      </View>
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
    const { tabs, activeTabId, isTabActive } = useBrowserTabsStore();

    // Filter out the specific new tab being added to prevent showing
    // its preview while it's being added so we have a smoother UI transition
    const displayTabs = newTabId
      ? tabs.filter((tab) => tab.id !== newTabId)
      : tabs;

    // Check if we should show the "Close all tabs" option in the context menu
    // Hide it if there's only 1 tab and it's the homepage
    const shouldShowCloseAllOption =
      tabs.length > 1 || (tabs.length === 1 && !isHomepageUrl(tabs[0]?.url));

    const handleCloseActiveTab = useCallback(() => {
      if (activeTabId) {
        onCloseTab(activeTabId);
      }
    }, [activeTabId, onCloseTab]);

    return (
      <View className="flex-1">
        <TabOverviewHeader tabsCount={tabs.length} />

        {/* Tabs Grid */}
        <FlatList
          data={displayTabs}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: pxValue(16),
          }}
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

        <TabOverviewFooter
          onClose={onClose}
          onNewTab={onNewTab}
          onCloseActiveTab={handleCloseActiveTab}
          onCloseAllTabs={onCloseAllTabs}
          showCloseAllOption={shouldShowCloseAllOption}
        />
      </View>
    );
  },
);

TabOverview.displayName = "TabOverview";

export default TabOverview;
