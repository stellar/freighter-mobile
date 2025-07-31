import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { normalizeUrl, isHomepageUrl } from "helpers/browser";
import { isIOS } from "helpers/device";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback, useMemo } from "react";
import { Share, Linking, Platform } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Custom React hook providing browser tab action handlers for the in-app browser.
 *
 * @param webViewRef - Ref to the WebView instance
 * @returns Object with handlers for URL submission, navigation, reload, tab management, sharing, and context menu actions
 */
export const useBrowserActions = (
  webViewRef: React.RefObject<WebView | null>,
) => {
  const { activeTabId, goToPage, closeTab, closeAllTabs, getActiveTab } =
    useBrowserTabsStore();

  const { t } = useAppTranslation();

  const activeTab = getActiveTab();

  /**
   * Handler for submitting a URL or search query.
   * @param inputUrl - The user input string
   */
  const handleUrlSubmit = useCallback(
    (inputUrl: string) => {
      if (!activeTabId) return;

      const { url } = normalizeUrl(inputUrl);
      goToPage(activeTabId, url);
    },
    [activeTabId, goToPage],
  );

  /**
   * Handler for navigating back in the current tab's history.
   */
  const handleGoBack = useCallback(() => {
    if (!activeTab?.canGoBack) return;

    webViewRef.current?.goBack();
  }, [activeTab?.canGoBack, webViewRef]);

  /**
   * Handler for navigating forward in the current tab's history.
   */
  const handleGoForward = useCallback(() => {
    if (!activeTab?.canGoForward) return;

    webViewRef.current?.goForward();
  }, [activeTab?.canGoForward, webViewRef]);

  /**
   * Handler for reloading the current tab.
   */
  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, [webViewRef]);

  /**
   * Handler for closing the currently active tab.
   */
  const handleCloseActiveTab = useCallback(() => {
    if (!activeTabId) return;

    closeTab(activeTabId);
  }, [activeTabId, closeTab]);

  /**
   * Handler for closing all tabs.
   */
  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
  }, [closeAllTabs]);

  /**
   * Handler for sharing the current tab's URL and title.
   */
  const handleShare = useCallback(() => {
    if (!activeTab) return;

    Share.share({
      message: `${activeTab.title}\n${activeTab.url}`,
      url: activeTab.url,
    }).catch((error) => {
      logger.error("useBrowserActions", "Failed to share:", error);
    });
  }, [activeTab]);

  /**
   * Handler for opening the current tab's URL in the system browser.
   */
  const handleOpenInBrowser = useCallback(() => {
    if (!activeTab) return;

    Linking.openURL(activeTab.url).catch((error) => {
      logger.error("useBrowserActions", "Failed to open in browser:", error);
    });
  }, [activeTab]);

  // Check if current tab is on homepage
  const isOnHomepage = useMemo(
    () => (activeTab ? isHomepageUrl(activeTab.url) : false),
    [activeTab],
  );

  /**
   * Array of context menu actions for the current tab, including reload, share, open in browser, and close actions.
   */
  const contextMenuActions = useMemo(() => {
    // If on homepage, only show close actions
    if (isOnHomepage) {
      const homepageActions = [
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

      // Reverse the array for iOS to match Android behavior
      return isIOS ? homepageActions.reverse() : homepageActions;
    }

    // Otherwise show all actions
    const allActions = [
      {
        title: t("discovery.reload"),
        systemIcon: Platform.select({
          ios: "arrow.clockwise",
          android: "refresh",
        }),
        onPress: handleReload,
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
        title: t("discovery.openInBrowser"),
        systemIcon: Platform.select({
          ios: "safari",
          android: "public",
        }),
        onPress: handleOpenInBrowser,
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

    // Reverse the array for iOS to match Android behavior
    return isIOS ? allActions.reverse() : allActions;
  }, [
    isOnHomepage,
    t,
    handleOpenInBrowser,
    handleShare,
    handleReload,
    handleCloseAllTabs,
    handleCloseActiveTab,
  ]);

  return {
    handleUrlSubmit,
    handleGoBack,
    handleGoForward,
    handleReload,
    handleCloseActiveTab,
    handleCloseAllTabs,
    handleShare,
    handleOpenInBrowser,
    contextMenuActions,
  };
};
