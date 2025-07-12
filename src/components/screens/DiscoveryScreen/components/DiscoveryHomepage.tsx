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
import { captureTabScreenshot } from "helpers/screenshots";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";
import ViewShot from "react-native-view-shot";

interface DiscoveryHomepageProps {
  tabId: string;
}

interface HorizontalListSectionProps {
  title: string;
  icon: React.ReactNode;
  data: (TrendingSite | BrowserTab)[];
  onItemPress: (url: string) => void;
  onScrollEnd: () => Promise<void>;
}

const HorizontalListSection: React.FC<HorizontalListSectionProps> = ({
  title,
  icon,
  data,
  onItemPress,
  onScrollEnd,
}) => {
  const { themeColors } = useColors();
  const handleScrollEnd = useCallback(() => {
    onScrollEnd();
  }, [onScrollEnd]);

  const renderSiteItem = ({ item }: { item: TrendingSite | BrowserTab }) => {
    const getSiteName = (siteItem: TrendingSite | BrowserTab): string => {
      if ("name" in siteItem) {
        return siteItem.name;
      }

      // Try to relate the site title with some of the known trending sites for copy consistency
      const matchedTrendingSite = TRENDING_SITES.find(({ name }) =>
        siteItem.title.toLowerCase().includes(name.toLowerCase()),
      );

      if (matchedTrendingSite) {
        return matchedTrendingSite.name;
      }

      return siteItem.title;
    };

    const name = getSiteName(item);

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
          style={{ maxWidth: pxValue(76), textAlign: "center" }}
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
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingHorizontal: pxValue(DEFAULT_PADDING),
        }}
      />
    </View>
  );
};

const DiscoveryHomepage: React.FC<DiscoveryHomepageProps> = ({ tabId }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { goToPage, tabs, updateTab, showTabOverview } = useBrowserTabsStore();
  const viewShotRef = useRef<ViewShot>(null);

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

  const captureScreenshot = useCallback(async () => {
    await captureTabScreenshot({
      viewShotRef: viewShotRef.current,
      tabId,
      tabs,
      updateTab,
      source: "DiscoveryHomepage",
    });
  }, [tabs, tabId, updateTab]);

  // Capture screenshot on initial render and when tab overview is closed
  useEffect(() => {
    if (!showTabOverview) {
      captureScreenshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTabOverview]);

  return (
    <ViewShot
      ref={viewShotRef}
      options={{
        format: BROWSER_CONSTANTS.SCREENSHOT_FORMAT,
        quality: BROWSER_CONSTANTS.SCREENSHOT_QUALITY,
        result: "data-uri",
      }}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-background-primary">
        {recentTabs.length > 0 && (
          <HorizontalListSection
            title={t("discovery.recent")}
            icon={<Icon.ClockRewind color={themeColors.mint[9]} size={16} />}
            data={recentTabs}
            onItemPress={handleSitePress}
            onScrollEnd={captureScreenshot}
          />
        )}

        <HorizontalListSection
          title={t("discovery.trending")}
          icon={<Icon.Lightning01 color={themeColors.gold[9]} size={16} />}
          data={TRENDING_SITES}
          onItemPress={handleSitePress}
          onScrollEnd={captureScreenshot}
        />
      </View>
    </ViewShot>
  );
};

export default DiscoveryHomepage;
