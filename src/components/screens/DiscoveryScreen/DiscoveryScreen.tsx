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
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { formatDisplayUrl, isHomepageUrl } from "helpers/browser";
import { debug } from "helpers/debug";
import { useBrowserActions } from "hooks/useBrowserActions";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Animated, View } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [showTabs, setShowTabs] = useState(false);
  const [shouldRenderTabs, setShouldRenderTabs] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTab,
    getActiveTab,
    setLogo,
    setNavState,
    loadScreenshots,
  } = useBrowserTabsStore();

  const activeTab = getActiveTab();

  // Get browser actions from custom hook
  const browserActions = useBrowserActions(webViewRef);

  // Initialize with first tab if none exists and load screenshots
  useEffect(() => {
    if (tabs.length === 0) {
      addTab(BROWSER_CONSTANTS.HOMEPAGE_URL);
    } else {
      // Load screenshots for existing tabs
      loadScreenshots();
    }
  }, [tabs.length, addTab, loadScreenshots]);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(formatDisplayUrl(activeTab.url));
    }
  }, [activeTab]);

  // Animate tab overview screen with proper fade-in and fade-out
  useEffect(() => {
    if (showTabs) {
      // Show tabs immediately when opening
      setShouldRenderTabs(true);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_OPEN,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out when closing
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: BROWSER_CONSTANTS.TAB_ANIMATION_DURATION_CLOSE,
        useNativeDriver: true,
      }).start(() => {
        // Only unmount after animation completes
        setShouldRenderTabs(false);
      });
    }
  }, [showTabs, fadeAnim]);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (activeTabId) {
        setNavState(activeTabId, {
          canGoBack: navState.canGoBack,
          canGoForward: navState.canGoForward,
          isLoading: navState.loading,
        });

        updateTab(activeTabId, {
          url: navState.url,
          title: navState.title || BROWSER_CONSTANTS.DEFAULT_TAB_TITLE,
          screenshot: undefined, // Clear screenshot when URL changes
        });

        // Try to extract favicon (skip for homepage)
        if (!isHomepageUrl(navState.url)) {
          try {
            const urlObj = new URL(navState.url);
            const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
            setLogo(activeTabId, faviconUrl);
          } catch (error) {
            debug("DiscoveryScreen", "Failed to extract favicon:", error);
          }
        }
      }
    },
    [activeTabId, updateTab, setNavState, setLogo],
  );

  // Enhanced browser actions with proper state management
  const handleUrlSubmit = useCallback(() => {
    browserActions.handleUrlSubmit(inputUrl);
  }, [browserActions, inputUrl]);

  const handleNewTab = useCallback(() => {
    addTab(BROWSER_CONSTANTS.HOMEPAGE_URL);
  }, [addTab]);

  const handleCloseSpecificTab = useCallback(
    (tabId: string) => {
      closeTab(tabId);
      // If it's the last tab, open a default tab
      if (tabs.length === 1) {
        handleNewTab();
      }
    },
    [closeTab, tabs.length, handleNewTab],
  );

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setShowTabs(false);
    },
    [setActiveTab],
  );

  const handleShowTabs = useCallback(() => {
    setShowTabs(true);
  }, []);

  const handleCloseTabOverview = useCallback(() => {
    setShowTabs(false);
  }, []);

  const handleScreenshotCaptured = useCallback(
    (tabId: string, screenshot: string) => {
      updateTab(tabId, { screenshot });
    },
    [updateTab],
  );

  if (!activeTab) {
    return (
      <BaseLayout>
        <View className="flex-1 justify-center items-center">
          <Text>Loading...</Text>
        </View>
      </BaseLayout>
    );
  }

  // Tab Overview Screen (Rainbow-style) - Render when shouldRenderTabs is true
  if (shouldRenderTabs) {
    return (
      <BaseLayout
        insets={{ top: true, bottom: false, left: false, right: false }}
      >
        <TabOverview
          fadeAnim={fadeAnim}
          onClose={handleCloseTabOverview}
          onNewTab={handleNewTab}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseSpecificTab}
          onScreenshotCaptured={handleScreenshotCaptured}
        />
      </BaseLayout>
    );
  }

  // Main Browser Screen
  return (
    <BaseLayout
      insets={{ top: true, bottom: false, left: false, right: false }}
    >
      <UrlBar
        inputUrl={inputUrl}
        onInputChange={setInputUrl}
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
    </BaseLayout>
  );
};
