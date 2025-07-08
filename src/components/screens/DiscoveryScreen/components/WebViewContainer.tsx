import Homepage from "components/screens/DiscoveryScreen/Homepage";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import React from "react";
import { Freeze } from "react-freeze";
import { View } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

interface WebViewContainerProps {
  webViewRef: React.RefObject<WebView | null>;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
}

const WebViewContainer: React.FC<WebViewContainerProps> = ({
  webViewRef,
  onNavigationStateChange,
}) => {
  const { tabs, isTabActive } = useBrowserTabsStore();

  return (
    <View className="flex-1">
      {tabs.map((tab) => (
        <Freeze key={tab.id} freeze={!isTabActive(tab.id)}>
          {isHomepageUrl(tab.url) ? (
            <Homepage tabId={tab.id} />
          ) : (
            <WebView
              ref={isTabActive(tab.id) ? webViewRef : null}
              source={{ uri: tab.url }}
              onNavigationStateChange={
                isTabActive(tab.id) ? onNavigationStateChange : undefined
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
                        logger.debug(
                          "WalletConnect URI detected:",
                          request.url,
                        );
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
  );
};

export default WebViewContainer;
