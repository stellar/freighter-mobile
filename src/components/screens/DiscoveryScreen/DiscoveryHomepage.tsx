import { App } from "components/sds/App";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  BROWSER_CONSTANTS,
  TRENDING_SITES,
  TrendingSite,
} from "config/constants";
import { useBrowserTabsStore, BrowserTab } from "ducks/browserTabs";
import { getFaviconUrl, isHomepageUrl } from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";

interface DiscoveryHomepageProps {
  tabId: string;
}

interface HorizontalListSectionProps {
  title: string;
  icon: React.ReactNode;
  data: (TrendingSite | BrowserTab)[];
  onItemPress: (url: string) => void;
}

const HorizontalListSection: React.FC<HorizontalListSectionProps> = ({
  title,
  icon,
  data,
  onItemPress,
}) => {
  const { themeColors } = useColors();

  const renderSiteItem = ({ item }: { item: TrendingSite | BrowserTab }) => {
    const isTrendingSite = "name" in item;
    const name = isTrendingSite ? item.name : item.title;

    return (
      <TouchableOpacity
        className="mr-3 items-center"
        onPress={() => onItemPress(item.url)}
      >
        <View
          className="w-[76px] h-[76px] rounded-xl justify-center items-center mb-2"
          style={{ backgroundColor: themeColors.background.tertiary }}
        >
          <App appName={name} favicon={getFaviconUrl(item.url)} size="lg" />
        </View>
        <Text
          sm
          medium
          numberOfLines={2}
          style={{ maxWidth: 76, textAlign: "center" }}
        >
          {name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <View
        className="flex-row items-center gap-2 mb-3 mt-8"
        style={{ paddingLeft: pxValue(DEFAULT_PADDING) }}
      >
        {icon}
        <Text md medium>
          {title}
        </Text>
      </View>

      <FlatList
        horizontal
        data={data}
        renderItem={renderSiteItem}
        keyExtractor={(item) => ("name" in item ? item.url : item.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: pxValue(DEFAULT_PADDING),
        }}
      />
    </View>
  );
};

const DiscoveryHomepage: React.FC<DiscoveryHomepageProps> = ({ tabId }) => {
  const { themeColors } = useColors();
  const { goToPage, tabs } = useBrowserTabsStore();

  const handleSitePress = (url: string) => {
    goToPage(tabId, url);
  };

  const recentTabs = useMemo(
    () =>
      tabs
        .filter((tab) => !isHomepageUrl(tab.url))
        .sort((a, b) => b.lastAccessed - a.lastAccessed)
        .slice(0, BROWSER_CONSTANTS.MAX_RECENT_TABS),
    [tabs],
  );

  return (
    <View className="flex-1 bg-background-primary">
      {recentTabs.length > 0 && (
        <HorizontalListSection
          title="Recent"
          icon={<Icon.ClockRewind color={themeColors.mint[9]} size={16} />}
          data={recentTabs}
          onItemPress={handleSitePress}
        />
      )}

      <HorizontalListSection
        title="Trending"
        icon={<Icon.Lightning01 color={themeColors.gold[9]} size={16} />}
        data={TRENDING_SITES}
        onItemPress={handleSitePress}
      />
    </View>
  );
};

export default DiscoveryHomepage;
