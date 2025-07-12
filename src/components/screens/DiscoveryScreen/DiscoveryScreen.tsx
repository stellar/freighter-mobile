import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  UrlBar,
  BottomNavigation,
  TabOverview,
  WebViewContainer,
} from "components/screens/DiscoveryScreen/components";
import { Text } from "components/sds/Typography";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { formatDisplayUrl, getFaviconUrl } from "helpers/browser";
import useAppTranslation from "hooks/useAppTranslation";
import { useBrowserActions } from "hooks/useBrowserActions";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const mainContentFadeAnim = useRef(new Animated.Value(1)).current;
  const tabOverviewFadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTab,
    getActiveTab,
    loadScreenshots,
    showTabOverview,
    setShowTabOverview,
  } = useBrowserTabsStore();

  const activeTab = getActiveTab();

  // Get browser actions from custom hook
  const browserActions = useBrowserActions(webViewRef);

  // Adds a new default homepage tab
  const handleNewTab = useCallback(() => {
    addTab(BROWSER_CONSTANTS.HOMEPAGE_URL);
  }, [addTab]);

  // Initialize with first tab if none exists
  useEffect(() => {
    if (tabs.length === 0) {
      handleNewTab();
    }
  }, [tabs.length, handleNewTab]);

  useEffect(() => {
    if (tabs.length > 0) {
      // Load screenshots for existing tabs
      loadScreenshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      const formattedUrl = formatDisplayUrl(activeTab.url);
      setInputUrl(formattedUrl);
    }
  }, [activeTab?.url]);

  // Animate tab overview screen with proper fade-in and fade-out
  useEffect(() => {
    if (showTabOverview) {
      // Fade out main content and fade in tab overview
      Animated.parallel([
        Animated.timing(mainContentFadeAnim, {
          toValue: 0,
          duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_OPEN,
          useNativeDriver: true,
        }),
        Animated.timing(tabOverviewFadeAnim, {
          toValue: 1,
          duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_OPEN,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade in main content and fade out tab overview
      Animated.parallel([
        Animated.timing(mainContentFadeAnim, {
          toValue: 1,
          duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_CLOSE,
          useNativeDriver: true,
        }),
        Animated.timing(tabOverviewFadeAnim, {
          toValue: 0,
          duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_CLOSE,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showTabOverview, tabOverviewFadeAnim, mainContentFadeAnim]);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      // We are not interested in inactive tabs or loading states
      if (!activeTabId || navState.loading) {
        return;
      }

      logger.debug(
        "DiscoveryScreen",
        "handleNavigationStateChange, navState:",
        navState,
      );

      updateTab(activeTabId, {
        url: navState.url,
        logoUrl: getFaviconUrl(navState.url),
        title: navState.title || BROWSER_CONSTANTS.DEFAULT_TAB_TITLE,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      });
    },
    [activeTabId, updateTab],
  );

  // Memoize these callbacks to prevent child re-renders
  const handleUrlSubmit = useCallback(() => {
    browserActions.handleUrlSubmit(inputUrl);
  }, [browserActions, inputUrl]);

  const handleInputChange = useCallback((text: string) => {
    setInputUrl(text);
  }, []);

  const handleShowTabs = useCallback(() => {
    setShowTabOverview(true);
  }, [setShowTabOverview]);

  const handleHideTabs = useCallback(() => {
    setShowTabOverview(false);
  }, [setShowTabOverview]);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setShowTabOverview(false);
    },
    [setActiveTab, setShowTabOverview],
  );

  const handleCloseSpecificTab = useCallback(
    (tabId: string) => {
      closeTab(tabId);
      if (tabs.length === 1) {
        handleNewTab();
      }
    },
    [closeTab, tabs.length, handleNewTab],
  );

  if (!activeTab) {
    return (
      <BaseLayout>
        <View className="flex-1 justify-center items-center">
          <Text>{t("common.loading")}</Text>
        </View>
      </BaseLayout>
    );
  }

  // Main Browser Screen with TabOverview overlay
  return (
    <BaseLayout
      insets={{ top: true, bottom: false, left: false, right: false }}
    >
      {/* Main content that fades out when tabs are shown */}
      <Animated.View
        className="flex-1"
        style={{ opacity: mainContentFadeAnim }}
      >
        <UrlBar
          inputUrl={inputUrl}
          onInputChange={handleInputChange}
          onUrlSubmit={handleUrlSubmit}
          onShowTabs={handleShowTabs}
          tabsCount={tabs.length}
        />

        <WebViewContainer
          webViewRef={webViewRef}
          onNavigationStateChange={handleNavigationStateChange}
        />

        <BottomNavigation
          canGoBack={activeTab.canGoBack}
          canGoForward={activeTab.canGoForward}
          onGoBack={browserActions.handleGoBack}
          onGoForward={browserActions.handleGoForward}
          onNewTab={handleNewTab}
          contextMenuActions={browserActions.contextMenuActions}
        />
      </Animated.View>

      {/* Tabs overview overlay that fades out when tabs are hidden */}
      <Animated.View
        className="absolute inset-0 z-50"
        style={{ opacity: tabOverviewFadeAnim }}
      >
        <TabOverview
          onNewTab={handleNewTab}
          onClose={handleHideTabs}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseSpecificTab}
          insets={insets}
        />
      </Animated.View>
    </BaseLayout>
  );
};
