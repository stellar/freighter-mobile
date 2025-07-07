import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { BaseLayout } from "components/layout/BaseLayout";
import Homepage from "components/screens/DiscoveryBrowserScreen/Homepage";
import TabPreview from "components/screens/DiscoveryBrowserScreen/TabPreview";
import TabScreenshotCapture from "components/screens/DiscoveryBrowserScreen/TabScreenshotCapture";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useBrowserTabsStore, BrowserTab } from "ducks/browserTabs";
import { debug } from "helpers/debug";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Freeze } from "react-freeze";
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Share,
  Linking,
  Image,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

const HOMEPAGE_URL = "freighter://homepage";

export const DiscoveryBrowserScreen: React.FC<DiscoveryScreenProps> = () => {
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [showTabs, setShowTabs] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTab,
    closeAllTabs,
    getActiveTab,
    isTabActive,
    goToPage,
    setLogo,
    setNavState,
    loadScreenshots,
  } = useBrowserTabsStore();

  const activeTab = getActiveTab();

  // Initialize with first tab if none exists and load screenshots
  useEffect(() => {
    if (tabs.length === 0) {
      addTab(HOMEPAGE_URL);
    } else {
      // Load screenshots for existing tabs
      loadScreenshots();
    }
  }, [tabs.length, addTab, loadScreenshots]);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab) {
      // Don't update the input if it's a Google search URL - keep the original search term
      if (activeTab.url.startsWith("https://www.google.com/search?q=")) {
        // Extract the search query from the Google URL
        const urlParams = new URL(activeTab.url);
        const searchQuery = urlParams.searchParams.get("q");
        if (searchQuery) {
          setInputUrl(decodeURIComponent(searchQuery));
        } else {
          setInputUrl(activeTab.url);
        }
      } else if (activeTab.url === HOMEPAGE_URL) {
        setInputUrl("");
      } else {
        setInputUrl(activeTab.url);
      }
    }
  }, [activeTab]);

  // Animate tab overview screen
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showTabs ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
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
          title: navState.title || "New Tab",
          screenshot: undefined, // Clear screenshot when URL changes
        });

        // Try to extract favicon (skip for homepage)
        if (navState.url !== HOMEPAGE_URL) {
          try {
            const urlObj = new URL(navState.url);
            const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
            setLogo(activeTabId, faviconUrl);
          } catch (error) {
            debug(
              "DiscoveryBrowserScreen",
              "Failed to extract favicon:",
              error,
            );
          }
        }
      }
    },
    [activeTabId, updateTab, setNavState, setLogo],
  );

  const handleGoBack = () => {
    if (activeTab?.canGoBack) {
      webViewRef.current?.goBack();
    }
  };

  const handleGoForward = () => {
    if (activeTab?.canGoForward) {
      webViewRef.current?.goForward();
    }
  };

  const handleShowTabs = () => {
    setShowTabs(true);
  };

  const handleCloseTabOverview = () => {
    setShowTabs(false);
  };

  const handleNewTab = () => {
    addTab(HOMEPAGE_URL);
  };

  const handleCloseSpecificTab = (tabId: string) => {
    closeTab(tabId);
    // If it's the last tab, open a default tab
    if (tabs.length === 1) {
      handleNewTab();
    }
  };

  const handleSwitchTab = (tabId: string) => {
    setActiveTab(tabId);
    setShowTabs(false);
  };

  const handleUrlSubmit = () => {
    if (!activeTabId) return;

    let url = inputUrl.trim();

    // Check if it's already a valid URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      goToPage(activeTabId, url);
      webViewRef.current?.injectJavaScript(`window.location.href = "${url}";`);
      return;
    }

    // Check if it looks like a domain (contains . and no spaces)
    if (url.includes(".") && !url.includes(" ")) {
      url = `https://${url}`;
      goToPage(activeTabId, url);
      webViewRef.current?.injectJavaScript(`window.location.href = "${url}";`);
      return;
    }

    // If it's not a URL, treat it as a Google search query
    const searchQuery = encodeURIComponent(url);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

    goToPage(activeTabId, searchUrl);
    webViewRef.current?.injectJavaScript(
      `window.location.href = "${searchUrl}";`,
    );
  };

  const handleCloseActiveTab = () => {
    if (activeTabId) {
      closeTab(activeTabId);
      // If it's the last tab, open a default tab
      if (tabs.length === 1) {
        handleNewTab();
      }
    }
  };

  const handleCloseAllTabs = () => {
    closeAllTabs();
    // Always ensure at least one tab exists
    handleNewTab();
  };

  const handleReload = () => {
    webViewRef.current?.reload();
  };

  const handleShare = () => {
    if (activeTab) {
      Share.share({
        message: `${activeTab.title}\n${activeTab.url}`,
        url: activeTab.url,
      }).catch((error) => {
        debug("DiscoveryBrowserScreen", "Failed to share:", error);
      });
    }
  };

  const handleOpenInBrowser = () => {
    if (activeTab) {
      Linking.openURL(activeTab.url).catch((error) => {
        debug("DiscoveryBrowserScreen", "Failed to open in browser:", error);
      });
    }
  };

  const handleGoHome = () => {
    if (activeTabId) {
      goToPage(activeTabId, HOMEPAGE_URL);
      webViewRef.current?.injectJavaScript(
        `window.location.href = "${HOMEPAGE_URL}";`,
      );
    }
  };

  // Handle screenshot capture for tab previews
  const handleScreenshotCaptured = useCallback(
    (tabId: string, screenshot: string) => {
      updateTab(tabId, { screenshot });
    },
    [updateTab],
  );

  // Check if tab is on homepage
  const isTabOnHomepage = (tab: BrowserTab) =>
    !tab.url || tab.url === HOMEPAGE_URL;

  // Context menu actions for browser actions
  const browserContextMenuActions: MenuItem[] = [
    {
      title: "Open in Browser",
      systemIcon: Platform.select({
        ios: "safari",
        android: "public",
      }),
      onPress: handleOpenInBrowser,
    },
    {
      title: "Share",
      systemIcon: Platform.select({
        ios: "square.and.arrow.up",
        android: "share",
      }),
      onPress: handleShare,
    },
    {
      title: "Home",
      systemIcon: Platform.select({
        ios: "house",
        android: "home",
      }),
      onPress: handleGoHome,
    },
    {
      title: "Reload",
      systemIcon: Platform.select({
        ios: "arrow.clockwise",
        android: "refresh",
      }),
      onPress: handleReload,
    },
    {
      title: "Close All Tabs",
      systemIcon: Platform.select({
        ios: "xmark.circle.fill",
        android: "close",
      }),
      onPress: handleCloseAllTabs,
      destructive: true,
    },
    {
      title: "Close This Tab",
      systemIcon: Platform.select({
        ios: "xmark.circle",
        android: "close",
      }),
      onPress: handleCloseActiveTab,
      destructive: true,
    },
  ];

  if (!activeTab) {
    return (
      <BaseLayout>
        <View className="flex-1 justify-center items-center">
          <Text>Loading...</Text>
        </View>
      </BaseLayout>
    );
  }

  // Tab Overview Screen (Rainbow-style)
  if (showTabs) {
    return (
      <BaseLayout
        insets={{ top: true, bottom: false, left: false, right: false }}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
            backgroundColor: themeColors.background.primary,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border-default">
            <TouchableOpacity onPress={handleCloseTabOverview}>
              <Icon.X color={themeColors.base[1]} />
            </TouchableOpacity>
            <Text lg semiBold>
              {tabs.length} Tab{tabs.length !== 1 ? "s" : ""}
            </Text>
            <TouchableOpacity onPress={handleNewTab}>
              <Icon.Plus color={themeColors.base[1]} />
            </TouchableOpacity>
          </View>

          {/* Tabs Grid */}
          <ScrollView className="flex-1 p-4">
            <View className="flex-row flex-wrap justify-between">
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleSwitchTab(tab.id)}
                  className={`w-[48%] mb-4 rounded-lg overflow-hidden ${
                    isTabActive(tab.id)
                      ? "border-2 border-primary"
                      : "border border-border-default"
                  }`}
                >
                  {/* Tab Preview */}
                  <View className="h-64 bg-background-secondary justify-center items-center overflow-hidden relative">
                    {tab.screenshot ? (
                      <Image
                        source={{ uri: tab.screenshot }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onError={() => {
                          // Remove the screenshot if it fails to load
                          updateTab(tab.id, { screenshot: undefined });
                        }}
                      />
                    ) : (
                      <TabPreview
                        url={tab.url}
                        title={tab.title}
                        isActive={isTabActive(tab.id)}
                        logoUrl={tab.logoUrl}
                      />
                    )}

                    {/* Close button */}
                    {tabs.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleCloseSpecificTab(tab.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 justify-center items-center"
                      >
                        <Icon.X size={12} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Hidden WebViews for capturing screenshots */}
          {tabs.map((tab) => (
            <TabScreenshotCapture
              key={`screenshot-${tab.id}`}
              tabId={tab.id}
              url={tab.url}
              isVisible={showTabs && !tab.screenshot && !isTabOnHomepage(tab)}
              onScreenshotCaptured={(screenshot) => {
                handleScreenshotCaptured(tab.id, screenshot);
              }}
            />
          ))}
        </Animated.View>
      </BaseLayout>
    );
  }

  // Main Browser Screen
  return (
    <BaseLayout
      insets={{ top: true, bottom: false, left: false, right: false }}
    >
      {/* Top URL Bar */}
      <View className="flex-row items-center p-4 gap-3 bg-background-primary border-b border-border-default">
        <Avatar size="md" publicAddress={account?.publicKey ?? ""} />

        <TextInput
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={handleUrlSubmit}
          selectTextOnFocus
          placeholder="Search or enter a website"
          className="flex-1 px-3 py-2 h-10 bg-transparent border border-border-primary rounded-lg text-text-primary"
          placeholderTextColor={themeColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />

        {/* Show Tabs Button */}
        <TouchableOpacity
          onPress={handleShowTabs}
          className="w-10 h-10 border border-border-primary rounded-lg justify-center items-center bg-transparent"
        >
          <Text md semiBold>
            {tabs.length > 9 ? "9+" : tabs.length}
          </Text>
        </TouchableOpacity>
      </View>

      {/* WebViews for all tabs - only active tab is unfrozen */}
      <View className="flex-1">
        {tabs.map((tab) => (
          <Freeze key={tab.id} freeze={!isTabActive(tab.id)}>
            {isTabOnHomepage(tab) ? (
              <Homepage tabId={tab.id} />
            ) : (
              <WebView
                ref={isTabActive(tab.id) ? webViewRef : null}
                source={{ uri: tab.url }}
                onNavigationStateChange={
                  isTabActive(tab.id) ? handleNavigationStateChange : undefined
                }
                startInLoadingState={isTabActive(tab.id)}
                allowsBackForwardNavigationGestures={isTabActive(tab.id)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: isTabActive(tab.id) ? 1 : 0,
                }}
                // Handle WalletConnect deep links
                onShouldStartLoadWithRequest={
                  isTabActive(tab.id)
                    ? (request) => {
                        // Handle WalletConnect URIs
                        if (request.url.startsWith("wc:")) {
                          // Handle WalletConnect connection
                          debug("WalletConnect URI detected:", request.url);
                          return false;
                        }
                        return true;
                      }
                    : undefined
                }
              />
            )}
          </Freeze>
        ))}
      </View>

      {/* Bottom Navigation Bar */}
      <View className="flex-row items-center justify-between bg-background-primary border-t border-border-default pl-2 pr-5">
        <TouchableOpacity
          onPress={handleGoBack}
          disabled={!activeTab.canGoBack}
          className="p-4"
        >
          <Icon.ChevronLeft
            color={
              activeTab.canGoBack
                ? themeColors.base[1]
                : themeColors.text.secondary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGoForward}
          disabled={!activeTab.canGoForward}
          className="p-4"
        >
          <Icon.ChevronRight
            color={
              activeTab.canGoForward
                ? themeColors.base[1]
                : themeColors.text.secondary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNewTab} className="p-4">
          <Icon.Plus color={themeColors.base[1]} />
        </TouchableOpacity>

        <ContextMenuButton
          contextMenuProps={{
            actions: browserContextMenuActions,
          }}
          side="top"
          align="end"
          sideOffset={8}
        >
          <Icon.DotsHorizontal color={themeColors.base[1]} />
        </ContextMenuButton>
      </View>
    </BaseLayout>
  );
};
