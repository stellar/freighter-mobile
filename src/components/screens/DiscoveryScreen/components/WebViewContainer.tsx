import Homepage from "components/screens/DiscoveryScreen/Homepage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import { saveScreenshot, ScreenshotData } from "helpers/screenshots";
import React, { useRef, useCallback, useEffect } from "react";
import { Freeze } from "react-freeze";
import { View } from "react-native";
import ViewShot from "react-native-view-shot";
import { WebView, WebViewNavigation } from "react-native-webview";

interface WebViewContainerProps {
  webViewRef: React.RefObject<WebView | null>;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
}

const WebViewContainer: React.FC<WebViewContainerProps> = ({
  webViewRef,
  onNavigationStateChange,
}) => {
  const { tabs, isTabActive, updateTab } = useBrowserTabsStore();

  // Refs to track ViewShot components for each tab
  const viewShotRefs = useRef<{ [tabId: string]: ViewShot | null }>({});
  const webViewRefs = useRef<{ [tabId: string]: WebView | null }>({});
  const quickCaptureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>({});
  const finalCaptureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>({});

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
    },
    [],
  );

  return (
    <View className="flex-1">
      {tabs.map((tab) => (
        <Freeze key={tab.id} freeze={!isTabActive(tab.id)}>
          {isHomepageUrl(tab.url) ? (
            <Homepage tabId={tab.id} />
          ) : (
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
                opacity: isTabActive(tab.id) ? 1 : 0,
              }}
            >
              <WebView
                ref={(ref) => {
                  webViewRefs.current[tab.id] = ref;
                  if (isTabActive(tab.id)) {
                    // eslint-disable-next-line no-param-reassign
                    webViewRef.current = ref;
                  }
                }}
                source={{ uri: tab.url }}
                onNavigationStateChange={
                  isTabActive(tab.id) ? onNavigationStateChange : undefined
                }
                onLoadEnd={() => handleLoadEnd(tab.id)}
                startInLoadingState={isTabActive(tab.id)}
                allowsBackForwardNavigationGestures={isTabActive(tab.id)}
                onShouldStartLoadWithRequest={
                  isTabActive(tab.id)
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
          )}
        </Freeze>
      ))}
    </View>
  );
};

export default WebViewContainer;
