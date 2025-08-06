import { App } from "components/sds/App";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  BROWSER_CONSTANTS,
  DEFAULT_PRESS_DELAY,
} from "config/constants";
import { DiscoverProtocol } from "config/types";
import { useBrowserTabsStore, BrowserTab } from "ducks/browserTabs";
import { useProtocolsStore } from "ducks/protocols";
import { getFaviconUrl, isHomepageUrl } from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import { findMatchedProtocol } from "helpers/protocols";
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
  protocols: DiscoverProtocol[];
  title: string;
  icon: React.ReactNode;
  data: (DiscoverProtocol | BrowserTab)[];
  onItemPress: (url: string) => void;
  onScrollEnd: () => Promise<void>;
}

const HorizontalListSection: React.FC<HorizontalListSectionProps> = React.memo(
  ({ protocols, title, icon, data, onItemPress, onScrollEnd }) => {
    const { themeColors } = useColors();

    const handleScrollEnd = useCallback(() => {
      onScrollEnd();
    }, [onScrollEnd]);

    // Memoize renderSiteItem to avoid unnecessary re-renders
    const renderSiteItem = useCallback(
      (props: { item: DiscoverProtocol | BrowserTab }) => {
        const getSiteName = (
          siteItem: DiscoverProtocol | BrowserTab,
        ): string => {
          if ("name" in siteItem) {
            return siteItem.name;
          }

          // Try to relate with some of the known protocols for copy consistency
          const matchedProtocolSite = findMatchedProtocol({
            protocols,
            searchName: siteItem.title,
            searchUrl: siteItem.url,
          });

          return matchedProtocolSite?.name || siteItem.title;
        };

        const getSiteUrl = (
          siteItem: DiscoverProtocol | BrowserTab,
        ): string => {
          if ("websiteUrl" in siteItem) {
            return siteItem.websiteUrl;
          }

          return siteItem.url;
        };

        const getFavicon = (
          siteItem: DiscoverProtocol | BrowserTab,
        ): string => {
          if ("iconUrl" in siteItem) {
            return siteItem.iconUrl;
          }

          return getFaviconUrl(getSiteUrl(siteItem));
        };

        const name = getSiteName(props.item);
        const siteUrl = getSiteUrl(props.item);
        const favicon = getFavicon(props.item);

        return (
          <TouchableOpacity
            className="mr-3 items-center"
            onPress={() => onItemPress(siteUrl)}
            delayPressIn={DEFAULT_PRESS_DELAY}
          >
            <View
              className="w-[76px] h-[76px] rounded-xl justify-center items-center mb-2"
              style={{ backgroundColor: themeColors.background.tertiary }}
            >
              <App appName={name} favicon={favicon} size="lg" />
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
      },
      [onItemPress, protocols, themeColors.background.tertiary],
    );

    // Memoize contentContainerStyle to avoid unnecessary re-renders
    const contentContainerStyle = useMemo(
      () => ({
        paddingHorizontal: pxValue(DEFAULT_PADDING),
      }),
      [],
    );

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
          keyExtractor={(item) =>
            "websiteUrl" in item ? item.websiteUrl : item.id
          }
          showsHorizontalScrollIndicator={false}
          onScrollEndDrag={handleScrollEnd}
          contentContainerStyle={contentContainerStyle}
        />
      </View>
    );
  },
);

const DiscoveryHomepage: React.FC<DiscoveryHomepageProps> = React.memo(
  ({ tabId }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();
    const { goToPage, tabs, updateTab, showTabOverview } =
      useBrowserTabsStore();
    const { protocols } = useProtocolsStore();
    const viewShotRef = useRef<ViewShot>(null);

    const handleSitePress = useCallback(
      (url: string) => {
        goToPage(tabId, url);
      },
      [goToPage, tabId],
    );

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
          width: BROWSER_CONSTANTS.SCREENSHOT_WIDTH,
          height: BROWSER_CONSTANTS.SCREENSHOT_HEIGHT,
          result: "data-uri",
        }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-background-primary">
          {recentTabs.length > 0 && (
            <HorizontalListSection
              protocols={protocols}
              title={t("discovery.recent")}
              icon={<Icon.ClockRewind color={themeColors.mint[9]} size={16} />}
              data={recentTabs}
              onItemPress={handleSitePress}
              onScrollEnd={captureScreenshot}
            />
          )}

          {protocols.length > 0 && (
            <HorizontalListSection
              protocols={protocols}
              title={t("discovery.trending")}
              icon={<Icon.Lightning01 color={themeColors.gold[9]} size={16} />}
              data={protocols}
              onItemPress={handleSitePress}
              onScrollEnd={captureScreenshot}
            />
          )}

          <View
            className="bg-background-tertiary p-4 pr-5 rounded-2xl mt-4"
            style={{ marginHorizontal: pxValue(DEFAULT_PADDING) }}
          >
            <Text xs secondary medium>
              {t("discovery.legalDisclaimer")}
            </Text>
          </View>
        </View>
      </ViewShot>
    );
  },
);

export default DiscoveryHomepage;
