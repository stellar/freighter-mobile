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
import {
  WebView,
  WebViewNavigation,
  WebViewMessageEvent,
} from "react-native-webview";

interface WebViewContainerProps {
  webViewRef: React.RefObject<WebView | null>;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
}

interface ContentCheckData {
  type: string;
  hasContent: boolean;
  isLoading: boolean;
  hasError: boolean;
  title: string;
  bodyText: string;
}

const WebViewContainer: React.FC<WebViewContainerProps> = ({
  webViewRef,
  onNavigationStateChange,
}) => {
  const { tabs, isTabActive, updateTab } = useBrowserTabsStore();

  // Refs to track ViewShot components for each tab
  const viewShotRefs = useRef<{ [tabId: string]: ViewShot | null }>({});
  const webViewRefs = useRef<{ [tabId: string]: WebView | null }>({});
  const captureTimeouts = useRef<{ [tabId: string]: NodeJS.Timeout }>({});

  // JavaScript to check if the page has meaningful content
  const checkContentScript = `
    (function() {
      const hasContent = document.body && 
        (document.body.children.length > 0 || 
         document.body.textContent.trim().length > 10 ||
         document.querySelector('img, video, canvas, svg') !== null ||
         document.querySelector('div, section, main, article') !== null);
      
      const isLoading = document.body && 
        (document.body.textContent.includes('Loading...') ||
         document.body.textContent.includes('loading...') ||
         document.querySelector('.loading, .spinner, .loader, [class*="loading"]') !== null);
      
      const hasError = document.body && 
        (document.body.textContent.includes('Enable JavaScript to run this app') ||
         document.body.textContent.includes('Please enable JavaScript') ||
         document.body.textContent.includes('JavaScript is required') ||
         document.body.textContent.includes('not supported'));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'contentCheck',
        hasContent: hasContent,
        isLoading: isLoading,
        hasError: hasError,
        title: document.title || '',
        bodyText: document.body ? document.body.textContent.substring(0, 50) : ''
      }));
    })();
  `;

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

  const handleMessage = useCallback(
    (event: WebViewMessageEvent, tabId: string) => {
      try {
        const data: ContentCheckData = JSON.parse(event.nativeEvent.data);
        if (data.type === "contentCheck") {
          // Clear any existing timeout
          if (captureTimeouts.current[tabId]) {
            clearTimeout(captureTimeouts.current[tabId]);
          }

          if (data.hasContent && !data.hasError) {
            // If we have content and no errors, capture after a delay
            captureTimeouts.current[tabId] = setTimeout(() => {
              captureScreenshot(tabId);
            }, BROWSER_CONSTANTS.SCREENSHOT_CAPTURE_DELAY);
          } else if (data.isLoading) {
            // If still loading, try again after a delay
            captureTimeouts.current[tabId] = setTimeout(() => {
              const webVwRef = webViewRefs.current[tabId];
              if (webVwRef) {
                webVwRef.injectJavaScript(checkContentScript);
              }
            }, BROWSER_CONSTANTS.SCREENSHOT_RETRY_DELAY);
          } else {
            // If we've tried enough or no content, capture anyway
            captureScreenshot(tabId);
          }
        }
      } catch (error) {
        logger.error(
          "WebViewContainer",
          "Error parsing WebView message:",
          error,
        );
        captureScreenshot(tabId);
      }
    },
    [captureScreenshot, checkContentScript],
  );

  const handleLoadEnd = useCallback(
    (tabId: string) => {
      // Start content check after page loads
      setTimeout(() => {
        const webVwRef = webViewRefs.current[tabId];
        if (webVwRef) {
          webVwRef.injectJavaScript(checkContentScript);
        }
      }, BROWSER_CONSTANTS.SCREENSHOT_INITIAL_DELAY);
    },
    [checkContentScript],
  );

  // Cleanup timeouts when component unmounts
  useEffect(
    () => () => {
      Object.values(captureTimeouts.current).forEach((timeout) => {
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
                onMessage={(event) => handleMessage(event, tab.id)}
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
