import { BROWSER_CONSTANTS } from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { normalizeUrl } from "helpers/browser";
import { debug } from "helpers/debug";
import { useCallback } from "react";
import { Share, Linking, Platform } from "react-native";
import { WebView } from "react-native-webview";

export const useBrowserActions = (
  webViewRef: React.RefObject<WebView | null>,
) => {
  const { activeTabId, goToPage, closeTab, closeAllTabs, getActiveTab, tabs } =
    useBrowserTabsStore();

  const handleUrlSubmit = useCallback(
    (inputUrl: string) => {
      if (!activeTabId) return;

      const { url } = normalizeUrl(inputUrl);
      goToPage(activeTabId, url);
      webViewRef.current?.injectJavaScript(`window.location.href = "${url}";`);
    },
    [activeTabId, goToPage, webViewRef],
  );

  const handleGoBack = useCallback(() => {
    const activeTab = getActiveTab();
    if (activeTab?.canGoBack) {
      webViewRef.current?.goBack();
    }
  }, [getActiveTab, webViewRef]);

  const handleGoForward = useCallback(() => {
    const activeTab = getActiveTab();
    if (activeTab?.canGoForward) {
      webViewRef.current?.goForward();
    }
  }, [getActiveTab, webViewRef]);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, [webViewRef]);

  const handleGoHome = useCallback(() => {
    if (activeTabId) {
      goToPage(activeTabId, BROWSER_CONSTANTS.HOMEPAGE_URL);
      webViewRef.current?.injectJavaScript(
        `window.location.href = "${BROWSER_CONSTANTS.HOMEPAGE_URL}";`,
      );
    }
  }, [activeTabId, goToPage, webViewRef]);

  const handleCloseActiveTab = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
      // If it's the last tab, open a default tab
      if (tabs.length === 1) {
        // This will be handled by the component that uses this hook
      }
    }
  }, [activeTabId, closeTab, tabs.length]);

  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
    // Always ensure at least one tab exists
    // This will be handled by the component that uses this hook
  }, [closeAllTabs]);

  const handleShare = useCallback(() => {
    const activeTab = getActiveTab();
    if (activeTab) {
      Share.share({
        message: `${activeTab.title}\n${activeTab.url}`,
        url: activeTab.url,
      }).catch((error) => {
        debug("useBrowserActions", "Failed to share:", error);
      });
    }
  }, [getActiveTab]);

  const handleOpenInBrowser = useCallback(() => {
    const activeTab = getActiveTab();
    if (activeTab) {
      Linking.openURL(activeTab.url).catch((error) => {
        debug("useBrowserActions", "Failed to open in browser:", error);
      });
    }
  }, [getActiveTab]);

  const handleCloseSpecificTab = useCallback(
    (tabId: string) => {
      closeTab(tabId);
      // If it's the last tab, open a default tab
      if (tabs.length === 1) {
        // This will be handled by the component that uses this hook
      }
    },
    [closeTab, tabs.length],
  );

  const handleNewTab = useCallback(() => {
    // This will be handled by the component that uses this hook
  }, []);

  const handleSwitchTab = useCallback(
    (tabId: string, onSwitch?: () => void) => {
      // This will be handled by the component that uses this hook
      onSwitch?.();
    },
    [],
  );

  const handleShowTabs = useCallback(() => {
    // This will be handled by the component that uses this hook
  }, []);

  const handleCloseTabOverview = useCallback(() => {
    // This will be handled by the component that uses this hook
  }, []);

  const contextMenuActions = [
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

  return {
    handleUrlSubmit,
    handleGoBack,
    handleGoForward,
    handleReload,
    handleGoHome,
    handleCloseActiveTab,
    handleCloseAllTabs,
    handleShare,
    handleOpenInBrowser,
    handleCloseSpecificTab,
    handleNewTab,
    handleSwitchTab,
    handleShowTabs,
    handleCloseTabOverview,
    contextMenuActions,
  };
};
