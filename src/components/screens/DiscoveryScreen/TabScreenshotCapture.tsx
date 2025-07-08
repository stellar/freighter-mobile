import { BROWSER_CONSTANTS } from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { debug } from "helpers/debug";
import { saveScreenshot, ScreenshotData } from "helpers/screenshots";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Freeze } from "react-freeze";
import { View } from "react-native";
import ViewShot from "react-native-view-shot";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface TabScreenshotCaptureProps {
  tabId: string;
  url: string;
  onScreenshotCaptured: (screenshot: string) => void;
  isVisible: boolean;
}

interface ContentCheckData {
  type: string;
  hasContent: boolean;
  isLoading: boolean;
  hasError: boolean;
  title: string;
  bodyText: string;
}

const TabScreenshotCapture: React.FC<TabScreenshotCaptureProps> = ({
  tabId,
  url,
  onScreenshotCaptured,
  isVisible,
}) => {
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasAttemptedCapture, setHasAttemptedCapture] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { updateTab } = useBrowserTabsStore();

  // JavaScript to check if the page has meaningful content
  const checkContentScript = `
    (function() {
      // More lenient content detection
      const hasContent = document.body && 
        (document.body.children.length > 0 || 
         document.body.textContent.trim().length > 10 ||
         document.querySelector('img, video, canvas, svg') !== null ||
         document.querySelector('div, section, main, article') !== null);
      
      // Check if it's not just a loading screen (more specific)
      const isLoading = document.body && 
        (document.body.textContent.includes('Loading...') ||
         document.body.textContent.includes('loading...') ||
         document.querySelector('.loading, .spinner, .loader, [class*="loading"]') !== null);
      
      // Check for common error messages (more specific)
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

  const captureScreenshot = useCallback(async () => {
    try {
      if (viewShotRef.current && viewShotRef.current.capture) {
        setHasAttemptedCapture(true);

        const uri = await viewShotRef.current.capture();

        // Save to persistent storage
        const screenshotData: ScreenshotData = {
          id: tabId,
          timestamp: Date.now(),
          uri,
          url,
        };

        await saveScreenshot(screenshotData);

        onScreenshotCaptured(uri);

        // Also update the tab with the screenshot
        updateTab(tabId, { screenshot: uri });
      }
    } catch (error) {
      debug("TabScreenshotCapture", "Failed to capture screenshot:", error);
      setHasAttemptedCapture(true);
    }
  }, [onScreenshotCaptured, updateTab, tabId, url]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data: ContentCheckData = JSON.parse(event.nativeEvent.data);
        if (data.type === "contentCheck") {
          // More aggressive capture strategy
          if (data.hasContent && !data.hasError) {
            // If we have content and no errors, capture immediately
            setTimeout(() => {
              captureScreenshot();
            }, BROWSER_CONSTANTS.SCREENSHOT_CONTENT_CHECK_DELAY);
          } else if (
            data.isLoading &&
            retryCount < BROWSER_CONSTANTS.MAX_SCREENSHOT_RETRIES
          ) {
            // If still loading, wait less time
            setRetryCount((prev) => prev + 1);
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(checkContentScript);
            }, BROWSER_CONSTANTS.SCREENSHOT_RETRY_DELAY);
          } else if (
            data.hasError &&
            retryCount < BROWSER_CONSTANTS.MAX_SCREENSHOT_RETRIES
          ) {
            // For JavaScript errors, try one more time with a delay
            setRetryCount((prev) => prev + 1);
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(checkContentScript);
            }, BROWSER_CONSTANTS.SCREENSHOT_ERROR_RETRY_DELAY);
          } else {
            // If we've tried enough or no content, capture anyway
            captureScreenshot();
          }
        }
      } catch (error) {
        debug("TabScreenshotCapture", "Error parsing WebView message:", error);
        captureScreenshot();
      }
    },
    [captureScreenshot, retryCount, checkContentScript],
  );

  const handleLoadEnd = useCallback(() => {
    setIsLoaded(true);
  }, []);

  /* eslint-disable consistent-return */
  useEffect(() => {
    if (isVisible && !hasAttemptedCapture) {
      // Reduced initial wait time
      const timer = setTimeout(() => {
        if (isLoaded && viewShotRef.current) {
          webViewRef.current?.injectJavaScript(checkContentScript);
        }
      }, BROWSER_CONSTANTS.SCREENSHOT_INITIAL_DELAY);

      // Reduced fallback timeout
      const fallbackTimer = setTimeout(() => {
        if (!hasAttemptedCapture) {
          captureScreenshot();
        }
      }, BROWSER_CONSTANTS.SCREENSHOT_CAPTURE_TIMEOUT);

      return () => {
        clearTimeout(timer);
        clearTimeout(fallbackTimer);
      };
    }
  }, [
    isVisible,
    isLoaded,
    hasAttemptedCapture,
    captureScreenshot,
    checkContentScript,
  ]);
  /* eslint-enable consistent-return */

  if (!isVisible) {
    return null;
  }

  return (
    <View className="absolute -left-[9999px] w-[300px] h-[200px]">
      <Freeze freeze={!isVisible}>
        <ViewShot
          ref={viewShotRef}
          options={{
            format: "png",
            quality: BROWSER_CONSTANTS.SCREENSHOT_QUALITY,
            result: "data-uri",
          }}
          style={{
            width: BROWSER_CONSTANTS.SCREENSHOT_WIDTH,
            height: BROWSER_CONSTANTS.SCREENSHOT_HEIGHT,
          }}
        >
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            onLoadEnd={handleLoadEnd}
            onMessage={handleMessage}
            className="w-[300px] h-[200px]"
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            mixedContentMode="compatibility"
            // Add these for better performance
            startInLoadingState={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </ViewShot>
      </Freeze>
    </View>
  );
};

export default TabScreenshotCapture;
