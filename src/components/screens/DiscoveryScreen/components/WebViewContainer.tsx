import Spinner from "components/Spinner";
import { DiscoveryHomepage } from "components/screens/DiscoveryScreen/components";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import { captureTabScreenshot } from "helpers/screenshots";
import useColors from "hooks/useColors";
import React, { useRef, useCallback, useEffect, useState } from "react";
import { Freeze } from "react-freeze";
import { View, Animated } from "react-native";
import ViewShot from "react-native-view-shot";
import { WebView, WebViewNavigation } from "react-native-webview";

interface WebViewContainerProps {
  webViewRef: React.RefObject<WebView | null>;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
  onShouldStartLoadWithRequest: (request: WebViewNavigation) => boolean;
}

// Memoize to avoid unnecessary expensive re-renders
const WebViewContainer: React.FC<WebViewContainerProps> = React.memo(
  ({ webViewRef, onNavigationStateChange, onShouldStartLoadWithRequest }) => {
    const { tabs, isTabActive, updateTab, activeTabId } = useBrowserTabsStore();
    const { themeColors } = useColors();

    const [isLoading, setIsLoading] = useState(false);
    const fadeLoadingAnim = useRef(new Animated.Value(0)).current;

    // Refs to track ViewShot components for each tab
    const viewShotRefs = useRef<{ [tabId: string]: ViewShot | null }>({});
    const webViewRefs = useRef<{ [tabId: string]: WebView | null }>({});
    const quickCaptureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>(
      {},
    );
    const finalCaptureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>(
      {},
    );
    const scrollCaptureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>(
      {},
    );

    /**
     * Clears WebView cache for a specific WebView instance without affecting cookies
     * @param webViewInstance - The WebView instance to clear cache for
     */
    const clearWebViewCache = useCallback((webViewInstance: WebView | null) => {
      if (!webViewInstance) return;

      try {
        webViewInstance.clearCache?.(false); // false = preserve cookies
      } catch (error) {
        logger.warn("WebViewContainer", "Failed to clear WebView cache", error);
      }
    }, []);

    // Show spinner when switching tabs
    useEffect(() => {
      if (!activeTabId) {
        return undefined;
      }

      // Show spinner immediately
      setIsLoading(true);
      fadeLoadingAnim.setValue(1);

      // Fade out after 500ms
      const timer = setTimeout(() => {
        Animated.timing(fadeLoadingAnim, {
          toValue: 0,
          duration: BROWSER_CONSTANTS.TAB_SWITCH_SPINNER_DURATION,
          useNativeDriver: true,
        }).start(() => {
          setIsLoading(false);
        });
      }, BROWSER_CONSTANTS.TAB_SWITCH_SPINNER_DELAY);

      return () => clearTimeout(timer);
    }, [activeTabId, fadeLoadingAnim]);

    const captureScreenshot = useCallback(
      async (tabId: string) => {
        await captureTabScreenshot({
          viewShotRef: viewShotRefs.current[tabId],
          tabId,
          tabs,
          updateTab,
          source: "WebViewContainer",
        });
      },
      [tabs, updateTab],
    );

    const handleScroll = useCallback(
      (tabId: string) => {
        // Clear any existing scroll capture timeout for this tab
        if (scrollCaptureTimeouts.current[tabId]) {
          clearTimeout(scrollCaptureTimeouts.current[tabId]);
        }

        // Capture screenshot after 1s of no-scrolling
        scrollCaptureTimeouts.current[tabId] = setTimeout(() => {
          captureScreenshot(tabId);
          delete scrollCaptureTimeouts.current[tabId];
        }, BROWSER_CONSTANTS.SCREENSHOT_SCROLL_DELAY);
      },
      [captureScreenshot],
    );

    const handleLoadEnd = useCallback(
      (tabId: string) => {
        logger.debug("WebViewContainer", "handleLoadEnd, tabId:", tabId);

        // Clear any existing timeouts for this tab
        if (quickCaptureTimeouts.current[tabId]) {
          clearTimeout(quickCaptureTimeouts.current[tabId]);
        }
        if (finalCaptureTimeouts.current[tabId]) {
          clearTimeout(finalCaptureTimeouts.current[tabId]);
        }

        // Quick screenshot for immediate preview (500ms)
        quickCaptureTimeouts.current[tabId] = setTimeout(() => {
          captureScreenshot(tabId);
          delete quickCaptureTimeouts.current[tabId];
        }, BROWSER_CONSTANTS.SCREENSHOT_ON_LOAD_DELAY);

        // Final screenshot after animations complete (2000ms)
        finalCaptureTimeouts.current[tabId] = setTimeout(() => {
          // Clear the quick timeout if it hasn't fired yet
          if (quickCaptureTimeouts.current[tabId]) {
            clearTimeout(quickCaptureTimeouts.current[tabId]);
            delete quickCaptureTimeouts.current[tabId];
          }
          // Capture final screenshot after animations should be complete
          captureScreenshot(tabId);
          delete finalCaptureTimeouts.current[tabId];
        }, BROWSER_CONSTANTS.SCREENSHOT_FINAL_DELAY);
      },
      [captureScreenshot],
    );

    // Cleanup timeouts when component unmounts
    useEffect(
      () => () => {
        Object.values(quickCaptureTimeouts.current).forEach((timeout) => {
          if (timeout) clearTimeout(timeout);
        });
        Object.values(finalCaptureTimeouts.current).forEach((timeout) => {
          if (timeout) clearTimeout(timeout);
        });
        Object.values(scrollCaptureTimeouts.current).forEach((timeout) => {
          if (timeout) clearTimeout(timeout);
        });
      },
      [],
    );

    return (
      <View className="flex-1">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.id);

          return (
            <Freeze key={tab.id} freeze={!isActive}>
              {isHomepageUrl(tab.url) ? (
                <DiscoveryHomepage tabId={tab.id} />
              ) : (
                <View
                  className={`absolute inset-0 ${isActive ? "opacity-100" : "opacity-0"}`}
                >
                  <ViewShot
                    ref={(ref) => {
                      viewShotRefs.current[tab.id] = ref;
                    }}
                    options={{
                      format: BROWSER_CONSTANTS.SCREENSHOT_FORMAT,
                      quality: BROWSER_CONSTANTS.SCREENSHOT_QUALITY,
                      width: BROWSER_CONSTANTS.SCREENSHOT_WIDTH,
                      height: BROWSER_CONSTANTS.SCREENSHOT_HEIGHT,
                      result: "data-uri",
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <WebView
                      // The "iOS" user agent seems to work better for WalletConnect in all cases
                      userAgent={BROWSER_CONSTANTS.IOS_USER_AGENT}
                      allowsLinkPreview={false}
                      javaScriptEnabled
                      domStorageEnabled
                      startInLoadingState
                      injectedJavaScriptBeforeContentLoaded={`
                        window.stellar = {
                          provider: 'freighter',
                          platform: 'mobile',
                          version: '0.9.23'
                        };
                      `}
                      ref={(ref) => {
                        webViewRefs.current[tab.id] = ref;
                        if (isActive) {
                          // eslint-disable-next-line no-param-reassign
                          webViewRef.current = ref;
                        }

                        // Clear WebView cache whenever a WebView is about to render
                        // This ensures we always render from a fresh state but without affecting cookies
                        if (ref) {
                          clearWebViewCache(ref);
                        }
                      }}
                      source={{ uri: tab.url }}
                      onLoadEnd={() => handleLoadEnd(tab.id)}
                      onScroll={() => handleScroll(tab.id)}
                      allowsBackForwardNavigationGestures={isActive}
                      onNavigationStateChange={
                        isActive ? onNavigationStateChange : undefined
                      }
                      onShouldStartLoadWithRequest={
                        isActive ? onShouldStartLoadWithRequest : () => true
                      }
                    />
                  </ViewShot>

                  {/* Loading spinner overlay for smoother tab transition */}
                  {isActive && isLoading && (
                    <Animated.View
                      className="absolute inset-0 justify-center items-center z-[50] pointer-events-none"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        opacity: fadeLoadingAnim,
                      }}
                    >
                      <Spinner size="small" color={themeColors.gray[10]} />
                    </Animated.View>
                  )}
                </View>
              )}
            </Freeze>
          );
        })}
      </View>
    );
  },
);

WebViewContainer.displayName = "WebViewContainer";

export default WebViewContainer;
