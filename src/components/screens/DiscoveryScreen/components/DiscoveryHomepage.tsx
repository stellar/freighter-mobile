import { BottomSheetModal } from "@gorhom/bottom-sheet";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { TrendingItem } from "components/TrendingCarousel";
import { DEFAULT_HEADER_BUTTON_SIZE } from "components/layout/CustomHeaderButton";
import ExpandedSectionView from "components/screens/DiscoveryScreen/components/ExpandedSectionView";
import ProtocolDetailsBottomSheet from "components/screens/DiscoveryScreen/components/ProtocolDetailsBottomSheet";
import TrendingCarouselSection from "components/screens/DiscoveryScreen/components/TrendingCarouselSection";
import VerticalListSection, {
  VerticalListItem,
} from "components/screens/DiscoveryScreen/components/VerticalListSection";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, BROWSER_CONSTANTS } from "config/constants";
import { DiscoverProtocol } from "config/types";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useProtocolsStore } from "ducks/protocols";
import { useRecentProtocolsStore } from "ducks/recentProtocols";
import { pxValue } from "helpers/dimensions";
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
import { Animated, View, ScrollView } from "react-native";
import ViewShot from "react-native-view-shot";
import { analytics } from "services/analytics";
import { DISCOVER_ANALYTICS_SOURCE } from "services/analytics/discover";

interface DiscoveryHomepageProps {
  tabId: string;
}

interface ExpandedSection {
  title: string;
  items: VerticalListItem[];
  isRecents?: boolean;
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

const DiscoveryHomepage: React.FC<DiscoveryHomepageProps> = React.memo(
  ({ tabId }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    const { goToPage, tabs, updateTab, showTabOverview } =
      useBrowserTabsStore();
    const { protocols } = useProtocolsStore();
    const { recentProtocols, addRecentProtocol, clearRecentProtocols } =
      useRecentProtocolsStore();
    const viewShotRef = useRef<ViewShot>(null);
    const protocolDetailsRef = useRef<BottomSheetModal>(null);
    const [expandedSection, setExpandedSection] =
      useState<ExpandedSection | null>(null);
    const [selectedProtocol, setSelectedProtocol] =
      useState<ProtocolDetailsData | null>(null);
    const expandedFadeAnim = useRef(new Animated.Value(0)).current;
    const protocolSourceRef = useRef("");
    const expandedSourceRef = useRef("");

    const handleSitePress = useCallback(
      (url: string) => {
        addRecentProtocol(url, protocols);
        goToPage(tabId, url);
      },
      [addRecentProtocol, goToPage, protocols, tabId],
    );

    const trendingItems: TrendingItem[] = useMemo(
      () =>
        protocols
          .filter((protocol) => protocol.isTrending)
          .map((protocol) => ({
            id: protocol.websiteUrl,
            title: protocol.name,
            category: protocol.tags[0],
            backgroundUrl: protocol.backgroundUrl,
          })),
      [protocols],
    );

    const recentProtocolItems: DiscoverProtocol[] = useMemo(
      () =>
        recentProtocols
          .map((entry) =>
            protocols.find((p) => p.websiteUrl === entry.websiteUrl),
          )
          .filter((p): p is DiscoverProtocol => p !== undefined),
      [recentProtocols, protocols],
    );

    const recentItems: VerticalListItem[] = useMemo(
      () => recentProtocolItems.map(protocolToListItem),
      [recentProtocolItems],
    );

    const dappsItems: VerticalListItem[] = useMemo(
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

    const handleItemOpenWithSource = useCallback(
      (item: VerticalListItem, source: string) => {
        analytics.trackDiscoverProtocolOpened(
          item.websiteUrl,
          source,
          protocols,
        );
        handleSitePress(item.websiteUrl);
      },
      [handleSitePress, protocols],
    );

    const handleRecentItemOpen = useCallback(
      (item: VerticalListItem) =>
        handleItemOpenWithSource(item, DISCOVER_ANALYTICS_SOURCE.RECENT_LIST),
      [handleItemOpenWithSource],
    );

    const handleDappsItemOpen = useCallback(
      (item: VerticalListItem) =>
        handleItemOpenWithSource(item, DISCOVER_ANALYTICS_SOURCE.DAPPS_LIST),
      [handleItemOpenWithSource],
    );

    const handleExpandedItemOpen = useCallback(
      (item: VerticalListItem) =>
        handleItemOpenWithSource(item, expandedSourceRef.current),
      [handleItemOpenWithSource],
    );

    const openProtocolDetails = useCallback(
      (item: VerticalListItem, source: string) => {
        protocolSourceRef.current = source;
        analytics.trackDiscoverProtocolDetailsViewed(item.name, item.tags);
        setSelectedProtocol({
          name: item.name,
          iconUrl: item.iconUrl,
          websiteUrl: item.websiteUrl,
          description: item.description,
          tags: item.tags,
        });
        protocolDetailsRef.current?.present();
      },
      [],
    );

    const handleRecentItemPress = useCallback(
      (item: VerticalListItem) =>
        openProtocolDetails(item, DISCOVER_ANALYTICS_SOURCE.RECENT_LIST),
      [openProtocolDetails],
    );

    const handleDappsItemPress = useCallback(
      (item: VerticalListItem) =>
        openProtocolDetails(item, DISCOVER_ANALYTICS_SOURCE.DAPPS_LIST),
      [openProtocolDetails],
    );

    const handleExpandedItemPress = useCallback(
      (item: VerticalListItem) =>
        openProtocolDetails(item, expandedSourceRef.current),
      [openProtocolDetails],
    );

    const handleTrendingItemPress = useCallback(
      (item: TrendingItem) => {
        const protocol = protocols.find((p) => p.websiteUrl === item.id);
        if (!protocol) return;
        openProtocolDetails(
          protocolToListItem(protocol),
          DISCOVER_ANALYTICS_SOURCE.TRENDING_CAROUSEL,
        );
      },
      [protocols, openProtocolDetails],
    );

    const handleProtocolOpen = useCallback(
      (url: string) => {
        if (selectedProtocol) {
          analytics.trackDiscoverProtocolOpenedFromDetails(
            selectedProtocol.name,
            url,
          );
        }
        analytics.trackDiscoverProtocolOpened(
          url,
          protocolSourceRef.current,
          protocols,
        );
        handleSitePress(url);
      },
      [selectedProtocol, handleSitePress, protocols],
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
      expandedSourceRef.current =
        DISCOVER_ANALYTICS_SOURCE.EXPANDED_RECENT_LIST;
      handleExpand({
        title: t("discovery.recent"),
        items: recentItems,
        isRecents: true,
      });
    }, [handleExpand, t, recentItems]);

    const handleClearRecents = useCallback(() => {
      clearRecentProtocols();
      handleCollapseSection();
    }, [clearRecentProtocols, handleCollapseSection]);

    const clearRecentsMenuActions: MenuItem[] = useMemo(
      () => [
        {
          title: t("discovery.clearRecents"),
          systemIcon: "trash",
          destructive: true,
          onPress: handleClearRecents,
        },
      ],
      [t, handleClearRecents],
    );

    const recentsHeaderRight = useMemo(
      () => (
        <ContextMenuButton
          contextMenuProps={{ actions: clearRecentsMenuActions }}
        >
          <View
            className={`${DEFAULT_HEADER_BUTTON_SIZE} items-center justify-center`}
          >
            <Icon.DotsHorizontal color={themeColors.text.primary} size={24} />
          </View>
        </ContextMenuButton>
      ),
      [clearRecentsMenuActions, themeColors.text.primary],
    );

    const handleExpandTrending = useCallback(() => {
      expandedSourceRef.current =
        DISCOVER_ANALYTICS_SOURCE.EXPANDED_TRENDING_LIST;
      handleExpand({
        title: t("discovery.trending"),
        items: dappsItems,
      });
    }, [handleExpand, t, dappsItems]);

    const handleExpandDapps = useCallback(() => {
      expandedSourceRef.current = DISCOVER_ANALYTICS_SOURCE.EXPANDED_DAPPS_LIST;
      handleExpand({
        title: t("discovery.dapps"),
        items: dappsItems,
      });
    }, [handleExpand, t, dappsItems]);

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
        <View className="items-center mt-4 mb-3 bg-background-primary">
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
          <TrendingCarouselSection
            title={t("discovery.trending")}
            items={trendingItems}
            onTitlePress={handleExpandTrending}
            onItemPress={handleTrendingItemPress}
            onScrollEnd={captureScreenshot}
          />

          <VerticalListSection
            title={t("discovery.recent")}
            items={recentItems}
            onTitlePress={handleExpandRecent}
            onItemOpen={handleRecentItemOpen}
            onItemPress={handleRecentItemPress}
          />

          <VerticalListSection
            title={t("discovery.dapps")}
            items={dappsItems}
            onTitlePress={handleExpandDapps}
            onItemOpen={handleDappsItemOpen}
            onItemPress={handleDappsItemPress}
          />

          <View
            className="bg-background-tertiary p-4 pr-5 rounded-2xl mt-8 mb-8"
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
              onItemOpen={handleExpandedItemOpen}
              onItemPress={handleExpandedItemPress}
              onScrollEnd={handleScrollEnd}
              headerRight={
                expandedSection.isRecents ? recentsHeaderRight : undefined
              }
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
