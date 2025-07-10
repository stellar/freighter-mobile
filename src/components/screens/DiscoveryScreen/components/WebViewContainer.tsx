import Spinner from "components/Spinner";
import Homepage from "components/screens/DiscoveryScreen/Homepage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import { saveScreenshot, ScreenshotData } from "helpers/screenshots";
import useColors from "hooks/useColors";
import React, { useRef, useCallback, useEffect, useState } from "react";
import { Freeze } from "react-freeze";
import { View, Animated } from "react-native";
import ViewShot from "react-native-view-shot";
import { WebView, WebViewNavigation } from "react-native-webview";

interface WebViewContainerProps {
  webViewRef: React.RefObject<WebView | null>;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
}

const WebViewContainer: React.FC<WebViewContainerProps> = React.memo(
  ({ webViewRef, onNavigationStateChange }) => {
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

    // Show spinner when active tab changes
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
          duration: 300, // 300ms fade out
          useNativeDriver: true,
        }).start(() => {
          setIsLoading(false);
        });
      }, 500);

      return () => clearTimeout(timer);
    }, [activeTabId, fadeLoadingAnim]);

    const captureScreenshot = useCallback(
      async (tabId: string) => {
        logger.debug(
          "WebViewContainer",
          "attempting to capture screenshot for tabId:",
          tabId,
        );
        try {
          const viewShotRef = viewShotRefs.current[tabId];
          if (viewShotRef && viewShotRef.capture) {
            const uri = await viewShotRef.capture();

            // Save to persistent storage
            const tab = tabs.find((t) => t.id === tabId);
            if (tab) {
              const screenshotData: ScreenshotData = {
                id: tabId,
                timestamp: Date.now(),
                uri,
                url: tab.url,
              };

              await saveScreenshot(screenshotData);
              updateTab(tabId, { screenshot: uri });

              logger.debug(
                "WebViewContainer",
                `Screenshot captured for tab ${tabId}`,
              );
            }
          }
        } catch (error) {
          logger.error(
            "WebViewContainer",
            `Failed to capture screenshot for tab ${tabId}:`,
            error,
          );
        }
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
        }, 1000);
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
        }, BROWSER_CONSTANTS.SCREENSHOT_CAPTURE_DELAY);

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
                <Homepage tabId={tab.id} />
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
                      startInLoadingState
                      ref={(ref) => {
                        webViewRefs.current[tab.id] = ref;
                        if (isActive) {
                          // eslint-disable-next-line no-param-reassign
                          webViewRef.current = ref;
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
                        isActive
                          ? (request: WebViewNavigation) => {
                              logger.debug(
                                "WebViewContainer",
                                "onShouldStartLoadWithRequest, request:",
                                request,
                              );

                              // Handle WalletConnect URIs
                              if (request.url.startsWith("wc:")) {
                                logger.debug(
                                  "WalletConnect URI detected:",
                                  request.url,
                                );
                                return false;
                              }
                              return true;
                            }
                          : () => true
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
