import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  BottomNavigationBar,
  TabOverview,
  WebViewContainer,
} from "components/screens/DiscoveryScreen/components";
import DiscoverWelcomeModal from "components/screens/DiscoveryScreen/components/DiscoverWelcomeModal";
import ManageAccounts from "components/screens/HomeScreen/ManageAccounts";
import { Text } from "components/sds/Typography";
import {
  BROWSER_CONSTANTS,
  DEFAULT_PADDING,
  STORAGE_KEYS,
} from "config/constants";
import { logger } from "config/logger";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { WALLET_KIT_MT_REDIRECT_NATIVE } from "ducks/walletKit";
import {
  formatDisplayUrl,
  getFaviconUrl,
  isHomepageUrl,
} from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBrowserActions } from "hooks/useBrowserActions";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Animated, Keyboard, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { analytics } from "services/analytics";
import {
  DISCOVER_ANALYTICS_SOURCE,
  DiscoverAnalyticsSource,
} from "services/analytics/discover";
import { dataStorage } from "services/storage/storageFactory";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const webViewRef = useRef<WebView>(null);
  const manageAccountsRef = useRef<BottomSheetModal>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [newTabId, setNewTabId] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const mainContentFadeAnim = useRef(new Animated.Value(1)).current;
  const tabOverviewFadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [isUrlBarFocused, setIsUrlBarFocused] = useState(false);
  const overlayFadeAnim = useRef(new Animated.Value(0)).current;
  const { t } = useAppTranslation();
  const { account } = useGetActiveAccount();
  const { allAccounts } = useAuthenticationStore();

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTab,
    getActiveTab,
    showTabOverview,
    setShowTabOverview,
  } = useBrowserTabsStore();

  const activeTab = getActiveTab();

  // Get browser actions from custom hook
  const browserActions = useBrowserActions(webViewRef);

  const handleAvatarPress = useCallback(() => {
    manageAccountsRef.current?.present();
  }, []);

  // Adds a new default homepage tab
  const handleNewTab = useCallback(
    (source: DiscoverAnalyticsSource) => {
      addTab(BROWSER_CONSTANTS.HOMEPAGE_URL);
      analytics.trackDiscoverTabCreated(
        useBrowserTabsStore.getState().tabs.length,
        source,
      );
    },
    [addTab],
  );

  // Handle new tab creation from TabOverview with smooth transition
  const handleNewTabFromOverview = useCallback(
    (source: DiscoverAnalyticsSource) => {
      // Create the new tab and get its ID
      const tabId = addTab(BROWSER_CONSTANTS.HOMEPAGE_URL);
      analytics.trackDiscoverTabCreated(
        useBrowserTabsStore.getState().tabs.length,
        source,
      );
      // Set the new tab ID to filter it out from TabOverview
      setNewTabId(tabId);
      // Hide the tab overview immediately
      setShowTabOverview(false);
      // Clear the new tab ID after animation ends
      setTimeout(() => {
        setNewTabId(null);
      }, BROWSER_CONSTANTS.CLOSE_ANIMATION_DURATION);
    },
    [addTab, setShowTabOverview],
  );

  // Initialize with homepage tab if no tabs are open (e.g. on app start)
  useEffect(() => {
    if (tabs.length === 0) {
      handleNewTab(DISCOVER_ANALYTICS_SOURCE.AUTOMATIC);
    }
  }, [tabs.length, handleNewTab]);

  // Show welcome modal on first visit
  useEffect(() => {
    dataStorage
      .getItem(STORAGE_KEYS.HAS_SEEN_DISCOVER_WELCOME)
      .then((value) => {
        if (!value) {
          setShowWelcomeModal(true);
          analytics.trackDiscoverWelcomeModalViewed();
        }
      })
      .catch((error) => {
        logger.error("Failed to read HAS_SEEN_DISCOVER_WELCOME from storage", {
          error,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade the dark overlay in/out when the search bar gains/loses focus.
  useEffect(() => {
    Animated.timing(overlayFadeAnim, {
      toValue: isUrlBarFocused ? 1 : 0,
      duration: isUrlBarFocused
        ? BROWSER_CONSTANTS.OPEN_ANIMATION_DURATION
        : BROWSER_CONSTANTS.CLOSE_ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [isUrlBarFocused, overlayFadeAnim]);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      const formattedUrl = formatDisplayUrl(activeTab.url);
      setInputUrl(formattedUrl);
    }
  }, [activeTab?.url]);

  // Animate tab overview screen with proper fade-in and fade-out
  useEffect(() => {
    // Stop any in-flight animations to prevent races on rapid toggle
    mainContentFadeAnim.stopAnimation();
    tabOverviewFadeAnim.stopAnimation();

    if (showTabOverview) {
      // Fade out main content and fade in tab overview
      Animated.parallel([
        Animated.timing(mainContentFadeAnim, {
          toValue: 0,
          duration: BROWSER_CONSTANTS.OPEN_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(tabOverviewFadeAnim, {
          toValue: 1,
          duration: BROWSER_CONSTANTS.OPEN_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade in main content and fade out tab overview
      Animated.parallel([
        Animated.timing(mainContentFadeAnim, {
          toValue: 1,
          duration: BROWSER_CONSTANTS.CLOSE_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(tabOverviewFadeAnim, {
          toValue: 0,
          duration: BROWSER_CONSTANTS.CLOSE_ANIMATION_DURATION,
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

  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      logger.debug(
        "WebViewContainer",
        "onShouldStartLoadWithRequest, request:",
        request,
      );

      // Block dangerous URL schemes that could execute arbitrary code
      const lowered = request.url.toLowerCase();
      if (
        lowered.startsWith("javascript:") ||
        lowered.startsWith("data:") ||
        lowered.startsWith("blob:")
      ) {
        logger.debug(
          "WebViewContainer",
          "Blocked navigation to dangerous scheme:",
          request.url,
        );
        return false;
      }

      // We should not handle WalletConnect URIs here
      // let's handle them in the useWalletKitEventsManager hook instead
      if (request.url.includes(WALLET_KIT_MT_REDIRECT_NATIVE)) {
        logger.debug(
          "WebViewContainer",
          "onShouldStartLoadWithRequest, WalletConnect URI detected:",
          request.url,
        );
        return false;
      }
      return true;
    },
    [],
  );

  // Memoize these callbacks to prevent child re-renders
  const handleUrlSubmit = useCallback(() => {
    browserActions.handleUrlSubmit(inputUrl);
  }, [browserActions, inputUrl]);

  const handleInputChange = useCallback((text: string) => {
    setInputUrl(text);
  }, []);

  const handleCancel = useCallback(() => {
    if (activeTab?.url) {
      setInputUrl(formatDisplayUrl(activeTab.url));
    }
  }, [activeTab?.url]);

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
      const currentTabs = useBrowserTabsStore.getState().tabs;
      const tabToClose = currentTabs.find((tab) => tab.id === tabId);
      const hadUrl = tabToClose?.url;

      closeTab(tabId);

      analytics.trackDiscoverTabClosed(currentTabs.length, hadUrl);

      // If it was the last tab, we need to add a new one to display the homepage
      if (currentTabs.length === 1) {
        // Use correct transition animation depending if closing from tabs grid or browser
        if (showTabOverview) {
          handleNewTabFromOverview(DISCOVER_ANALYTICS_SOURCE.AUTOMATIC);
        } else {
          handleNewTab(DISCOVER_ANALYTICS_SOURCE.AUTOMATIC);
        }
      }
    },
    [closeTab, showTabOverview, handleNewTab, handleNewTabFromOverview],
  );

  const handleCloseAllTabs = useCallback(() => {
    browserActions.handleCloseAllTabs();
    handleNewTabFromOverview(DISCOVER_ANALYTICS_SOURCE.AUTOMATIC);
  }, [browserActions, handleNewTabFromOverview]);

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
        style={[
          {
            position: "relative",
            opacity: mainContentFadeAnim,
            flex: 1,
          },
        ]}
      >
        <View className="flex-1">
          <WebViewContainer
            webViewRef={webViewRef}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            javaScriptEnabled
            domStorageEnabled
          />
          <Animated.View
            style={{
              position: "absolute",
              top: -2 * insets.top,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              opacity: overlayFadeAnim,
            }}
            pointerEvents={isUrlBarFocused ? "auto" : "none"}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={Keyboard.dismiss}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
            />
          </Animated.View>
        </View>

        <BottomNavigationBar
          inputUrl={inputUrl}
          onInputChange={handleInputChange}
          onUrlSubmit={handleUrlSubmit}
          onShowTabs={handleShowTabs}
          onCancel={handleCancel}
          onAvatarPress={handleAvatarPress}
          tabsCount={tabs.length}
          canGoBack={activeTab.canGoBack || !!activeTab.cameFromHomepage}
          onGoBack={browserActions.handleGoBack}
          contextMenuActions={browserActions.contextMenuActions}
          isHomePage={isHomepageUrl(activeTab.url)}
          onFocusChange={setIsUrlBarFocused}
        />
      </Animated.View>

      {/* Tabs overview overlay that fades out when tabs are hidden */}
      <Animated.View
        pointerEvents={showTabOverview ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            opacity: tabOverviewFadeAnim,
            top: insets.top + pxValue(DEFAULT_PADDING),
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 50,
          },
        ]}
      >
        <TabOverview
          onNewTab={() =>
            handleNewTabFromOverview(DISCOVER_ANALYTICS_SOURCE.TAB_OVERVIEW)
          }
          onClose={handleHideTabs}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseSpecificTab}
          onCloseAllTabs={handleCloseAllTabs}
          newTabId={newTabId}
        />
      </Animated.View>

      <ManageAccounts
        accounts={allAccounts}
        activeAccount={account}
        bottomSheetRef={manageAccountsRef}
        showAddWallet={false}
      />

      <DiscoverWelcomeModal
        visible={showWelcomeModal}
        onDismiss={() => {
          dataStorage.setItem(STORAGE_KEYS.HAS_SEEN_DISCOVER_WELCOME, "true");
          setShowWelcomeModal(false);
        }}
      />
    </BaseLayout>
  );
};
