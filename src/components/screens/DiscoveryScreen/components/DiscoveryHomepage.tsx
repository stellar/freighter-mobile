import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { images } from "assets/images";
import { TrendingCarousel, TrendingItem } from "components/TrendingCarousel";
import ExpandedSectionView from "components/screens/DiscoveryScreen/components/ExpandedSectionView";
import ProtocolDetailsBottomSheet from "components/screens/DiscoveryScreen/components/ProtocolDetailsBottomSheet";
import SectionTitle from "components/screens/DiscoveryScreen/components/SectionTitle";
import VerticalListSection, {
  VerticalListItem,
} from "components/screens/DiscoveryScreen/components/VerticalListSection";
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
import { findMatchedProtocol, getDisplayHost } from "helpers/protocols";
import { captureTabScreenshot } from "helpers/screenshots";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, {
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Animated,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
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

interface ExpandedSection {
  title: string;
  items: VerticalListItem[];
}

interface ProtocolDetailsData {
  name: string;
  iconUrl: string;
  websiteUrl: string;
  description: string;
  tags: string[];
}

const protocolToListItem = (protocol: DiscoverProtocol): VerticalListItem => ({
  id: protocol.websiteUrl,
  name: protocol.name,
  subtitle: protocol.tags[0] ?? "",
  iconUrl: protocol.iconUrl,
  websiteUrl: protocol.websiteUrl,
  description: protocol.description,
  tags: protocol.tags,
});

const tabToListItem = (
  tab: BrowserTab,
  protocols: DiscoverProtocol[],
): VerticalListItem => {
  const matched = findMatchedProtocol({ protocols, searchUrl: tab.url });
  return {
    id: tab.id,
    name: matched?.name ?? tab.title,
    subtitle: matched?.tags[0] ?? getDisplayHost(tab.url) ?? "",
    iconUrl: matched?.iconUrl ?? getFaviconUrl(tab.url),
    websiteUrl: matched?.websiteUrl ?? tab.url,
    description: matched?.description ?? "",
    tags: matched?.tags ?? [],
  };
};

const HorizontalListSection: React.FC<HorizontalListSectionProps> = React.memo(
  ({ protocols, title, icon, data, onItemPress, onScrollEnd }) => {
    const { themeColors } = useColors();

    const handleScrollEnd = useCallback(() => {
      onScrollEnd();
    }, [onScrollEnd]);

    const renderSiteItem = useCallback(
      (props: { item: DiscoverProtocol | BrowserTab }) => {
        const getSiteName = (
          siteItem: DiscoverProtocol | BrowserTab,
        ): string => {
          if ("name" in siteItem) {
            return siteItem.name;
          }

          const matchedProtocolSite = findMatchedProtocol({
            protocols,
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
    const protocolDetailsRef = useRef<BottomSheetModal>(null);
    const [expandedSection, setExpandedSection] =
      useState<ExpandedSection | null>(null);
    const [selectedProtocol, setSelectedProtocol] =
      useState<ProtocolDetailsData | null>(null);
    const expandedFadeAnim = useRef(new Animated.Value(0)).current;

    const handleSitePress = useCallback(
      (url: string) => {
        goToPage(tabId, url);
      },
      [goToPage, tabId],
    );

    const trendingItems: TrendingItem[] = useMemo(
      () =>
        protocols.map((protocol) => ({
          id: protocol.websiteUrl,
          title: protocol.name,
          category: protocol.tags[0],
          imageSource: images.featuredBackgroundPlaceholder,
        })),
      [protocols],
    );

    const recentTabs = useMemo(
      () =>
        tabs
          .filter((tab) => !isHomepageUrl(tab.url))
          .sort((a, b) => b.lastAccessed - a.lastAccessed)
          .slice(0, BROWSER_CONSTANTS.MAX_RECENT_TABS),
      [tabs],
    );

    const recentItems: VerticalListItem[] = useMemo(
      () => recentTabs.map((tab) => tabToListItem(tab, protocols)),
      [recentTabs, protocols],
    );

    const defiItems: VerticalListItem[] = useMemo(
      () =>
        protocols
          .filter((p) => p.tags.includes("DeFi"))
          .map(protocolToListItem),
      [protocols],
    );

    const exploreItems: VerticalListItem[] = useMemo(
      () => protocols.map(protocolToListItem),
      [protocols],
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

    const handleItemOpen = useCallback(
      (item: VerticalListItem) => {
        handleSitePress(item.websiteUrl);
      },
      [handleSitePress],
    );

    const handleItemPress = useCallback((item: VerticalListItem) => {
      setSelectedProtocol({
        name: item.name,
        iconUrl: item.iconUrl,
        websiteUrl: item.websiteUrl,
        description: item.description,
        tags: item.tags,
      });
      protocolDetailsRef.current?.present();
    }, []);

    const handleProtocolOpen = useCallback(
      (url: string) => {
        handleSitePress(url);
      },
      [handleSitePress],
    );

    const handleExpand = useCallback(
      (section: ExpandedSection) => {
        expandedFadeAnim.setValue(0);
        setExpandedSection(section);
      },
      [expandedFadeAnim],
    );

    // Start fade-in after the expanded view has mounted
    useEffect(() => {
      if (expandedSection) {
        Animated.timing(expandedFadeAnim, {
          toValue: 1,
          duration: BROWSER_CONSTANTS.OPEN_ANIMATION_DURATION,
          useNativeDriver: true,
        }).start();
      }
    }, [expandedSection, expandedFadeAnim]);

    const handleCollapseSection = useCallback(() => {
      Animated.timing(expandedFadeAnim, {
        toValue: 0,
        duration: BROWSER_CONSTANTS.CLOSE_ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => {
        setExpandedSection(null);
      });
    }, [expandedFadeAnim]);

    const handleExpandRecent = useCallback(() => {
      handleExpand({
        title: t("discovery.recent"),
        items: recentItems,
      });
    }, [handleExpand, t, recentItems]);

    const handleExpandDefi = useCallback(() => {
      handleExpand({
        title: t("discovery.defi"),
        items: defiItems,
      });
    }, [handleExpand, t, defiItems]);

    const handleExpandTrending = useCallback(() => {
      handleExpand({
        title: t("discovery.trending"),
        items: exploreItems,
      });
    }, [handleExpand, t, exploreItems]);

    const handleExpandExplore = useCallback(() => {
      handleExpand({
        title: t("discovery.explore"),
        items: exploreItems,
      });
    }, [handleExpand, t, exploreItems]);

    const handleScrollEnd = useCallback(() => {
      captureScreenshot();
    }, [captureScreenshot]);

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
        <View className="items-center mt-4 pb-4 bg-background-primary">
          <Text md medium>
            {t("discovery.discover")}
          </Text>
        </View>

        <ScrollView
          className="flex-1 bg-background-primary"
          showsVerticalScrollIndicator={false}
          onScrollEndDrag={handleScrollEnd}
          pointerEvents={expandedSection ? "none" : "auto"}
        >
          {trendingItems.length > 0 && (
            <View>
              <SectionTitle
                title={t("discovery.trending")}
                onPress={handleExpandTrending}
                className="mb-3"
                style={{ paddingLeft: pxValue(DEFAULT_PADDING) }}
              />
              <TrendingCarousel
                items={trendingItems}
                onItemPress={(item) => handleSitePress(item.id)}
                onScrollEnd={captureScreenshot}
              />
            </View>
          )}

          <VerticalListSection
            title={t("discovery.recent")}
            items={recentItems}
            onTitlePress={handleExpandRecent}
            onItemOpen={handleItemOpen}
            onItemPress={handleItemPress}
          />

          <VerticalListSection
            title={t("discovery.defi")}
            items={defiItems}
            onTitlePress={handleExpandDefi}
            onItemOpen={handleItemOpen}
            onItemPress={handleItemPress}
          />

          <VerticalListSection
            title={t("discovery.explore")}
            items={exploreItems}
            onTitlePress={handleExpandExplore}
            onItemOpen={handleItemOpen}
            onItemPress={handleItemPress}
          />

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
            className="bg-background-tertiary p-4 pr-5 rounded-2xl mt-4 mb-4"
            style={{ marginHorizontal: pxValue(DEFAULT_PADDING) }}
          >
            <Text xs secondary medium>
              {t("discovery.legalDisclaimer")}
            </Text>
          </View>
        </ScrollView>

        {expandedSection && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: expandedFadeAnim,
            }}
          >
            <ExpandedSectionView
              title={expandedSection.title}
              items={expandedSection.items}
              onBack={handleCollapseSection}
              onItemOpen={handleItemOpen}
              onItemPress={handleItemPress}
              onScrollEnd={handleScrollEnd}
            />
          </Animated.View>
        )}

        <ProtocolDetailsBottomSheet
          protocol={selectedProtocol}
          modalRef={protocolDetailsRef}
          onOpen={handleProtocolOpen}
        />
      </ViewShot>
    );
  },
);

export default DiscoveryHomepage;
