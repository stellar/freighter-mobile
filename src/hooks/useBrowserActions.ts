import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { normalizeUrl } from "helpers/browser";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback } from "react";
import { Share, Linking, Platform } from "react-native";
import { WebView } from "react-native-webview";

export const useBrowserActions = (
  webViewRef: React.RefObject<WebView | null>,
) => {
  const { activeTabId, goToPage, closeTab, closeAllTabs, getActiveTab } =
    useBrowserTabsStore();

  const { t } = useAppTranslation();

  const activeTab = getActiveTab();

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
    if (!activeTab?.canGoBack) return;

    webViewRef.current?.goBack();
  }, [activeTab?.canGoBack, webViewRef]);

  const handleGoForward = useCallback(() => {
    if (!activeTab?.canGoForward) return;

    webViewRef.current?.goForward();
  }, [activeTab?.canGoForward, webViewRef]);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, [webViewRef]);

  const handleGoHome = useCallback(() => {
    if (!activeTabId) return;

    goToPage(activeTabId, BROWSER_CONSTANTS.HOMEPAGE_URL);

    webViewRef.current?.injectJavaScript(
      `window.location.href = "${BROWSER_CONSTANTS.HOMEPAGE_URL}";`,
    );
  }, [activeTabId, goToPage, webViewRef]);

  const handleCloseActiveTab = useCallback(() => {
    if (!activeTabId) return;

    closeTab(activeTabId);
  }, [activeTabId, closeTab]);

  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
  }, [closeAllTabs]);

  const handleShare = useCallback(() => {
    if (!activeTab) return;

    Share.share({
      message: `${activeTab.title}\n${activeTab.url}`,
      url: activeTab.url,
    }).catch((error) => {
      logger.error("useBrowserActions", "Failed to share:", error);
    });
  }, [activeTab]);

  const handleOpenInBrowser = useCallback(() => {
    if (!activeTab) return;

    Linking.openURL(activeTab.url).catch((error) => {
      logger.error("useBrowserActions", "Failed to open in browser:", error);
    });
  }, [activeTab]);

  const contextMenuActions = [
    {
      title: t("discovery.openInBrowser"),
      systemIcon: Platform.select({
        ios: "safari",
        android: "public",
      }),
      onPress: handleOpenInBrowser,
    },
    {
      title: t("discovery.share"),
      systemIcon: Platform.select({
        ios: "square.and.arrow.up",
        android: "share",
      }),
      onPress: handleShare,
    },
    {
      title: t("discovery.home"),
      systemIcon: Platform.select({
        ios: "house",
        android: "home",
      }),
      onPress: handleGoHome,
    },
    {
      title: t("discovery.reload"),
      systemIcon: Platform.select({
        ios: "arrow.clockwise",
        android: "refresh",
      }),
      onPress: handleReload,
    },
    {
      title: t("discovery.closeAllTabs"),
      systemIcon: Platform.select({
        ios: "xmark.circle.fill",
        android: "close",
      }),
      onPress: handleCloseAllTabs,
      destructive: true,
    },
    {
      title: t("discovery.closeThisTab"),
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
    contextMenuActions,
  };
};
