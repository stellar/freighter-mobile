import Homepage from "components/screens/DiscoveryScreen/Homepage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import { saveScreenshot, ScreenshotData } from "helpers/screenshots";
import React, { useRef, useCallback } from "react";
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

  const captureScreenshot = useCallback(
    async (tabId: string) => {
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
      // Capture screenshot after page loads
      setTimeout(() => {
        captureScreenshot(tabId);
      }, BROWSER_CONSTANTS.SCREENSHOT_CAPTURE_DELAY);
    },
    [captureScreenshot],
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
                format: "png",
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
