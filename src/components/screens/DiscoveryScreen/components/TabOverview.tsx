import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import TabPreview from "components/screens/DiscoveryScreen/TabPreview";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BROWSER_CONSTANTS, DEFAULT_PADDING } from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { pxValue } from "helpers/dimensions";
import React from "react";
import { View, TouchableOpacity, FlatList } from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";

interface TabOverviewHeaderProps {
  tabsCount: number;
  onClose: () => void;
  onNewTab: () => void;
  insets: EdgeInsets;
}

const TabOverviewHeader: React.FC<TabOverviewHeaderProps> = ({
  tabsCount,
  onClose,
  onNewTab,
  insets,
}) => (
  <View
    className="flex-row items-center justify-between p-4 border-b border-border-default"
    style={{ paddingTop: insets.top + pxValue(DEFAULT_PADDING) }}
  >
    <CustomHeaderButton position="left" icon={Icon.X} onPress={onClose} />
    <Text lg semiBold>
      {tabsCount} Tab{tabsCount !== 1 ? "s" : ""}
    </Text>
    <CustomHeaderButton position="right" icon={Icon.Plus} onPress={onNewTab} />
  </View>
);

interface TabOverviewProps {
  onClose: () => void;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  insets: EdgeInsets;
}

const TabOverview: React.FC<TabOverviewProps> = React.memo(
  ({ onClose, onNewTab, onSwitchTab, onCloseTab, insets }) => {
    const { tabs, isTabActive } = useBrowserTabsStore();

    return (
      <View className="absolute inset-0 bg-background-primary">
        <TabOverviewHeader
          tabsCount={tabs.length}
          onClose={onClose}
          onNewTab={onNewTab}
          insets={insets}
        />

        {/* Tabs Grid */}
        <FlatList
          data={tabs}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: pxValue(16),
          }}
          contentContainerStyle={{ padding: pxValue(16) }}
          keyExtractor={(tab) => tab.id}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onSwitchTab(tab.id)}
              className={BROWSER_CONSTANTS.TAB_PREVIEW_TILE_SIZE}
            >
              <TabPreview
                title={tab.title}
                url={tab.url}
                logoUrl={tab.logoUrl}
                screenshot={tab.screenshot}
                isActive={isTabActive(tab.id)}
                showCloseButton={tabs.length > 1}
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
