import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { logger } from "config/logger";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, TextInput, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import Clipboard from "@react-native-clipboard/clipboard";
import Icon from "components/sds/Icon";
import { isIOS } from "helpers/device";
import { SCRIPTS_TO_INJECT } from "helpers/webviewScripts";
import { getUserAgent } from "react-native-device-info";
import * as webviewJS from "helpers/webviewScripts2";

export const USER_AGENT = {
  // Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148
  IOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  // Mozilla/5.0 (Linux; Android 14; sdk_gphone64_arm64 Build/UE1A.230829.036.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.7049.111 Mobile Safari/537.36
  ANDROID: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.103 Mobile Safari/537.36', // => THIS WORKS
};
// export const USER_AGENT_APPLICATION_NAME = 'Rainbow';

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

const initialUrl =  "https://aqua.network/wallet-connect?redirect=swap";
// const initialUrl =  "https://aqua.network";
// const initialUrl =  "https://www.google.com";

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { t } = useAppTranslation();
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const [userAgent, setUserAgent] = useState('');

  // useEffect(() => {
  //   const fetchUserAgent = async () => {
  //     // TODO: try using react-native-user-agent to see if it works better
  //     const userAgent = await getUserAgent();

  //     // const userAgentString = userAgent + (isIOS ? " Safari/604.1" : "");

  //     // ANDROID: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.103 Mobile Safari/537.36', // => THIS WORKS

  //     // NOTE: if we remove "wv" from the userAgent, it will work because it'll think it's a standalone browser instead of a webview
  //     // Mozilla/5.0 (Linux; Android 14; sdk_gphone64_arm64 Build/UE1A.230829.036.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.7049.111 Mobile Safari/537.36
  //     logger.debug("DiscoveryScreen", "> > > > > > userAgent", userAgent);

  //     setUserAgent(userAgent);
  //   };
  //   fetchUserAgent();
  // }, []);

  const handleGoPress = () => {
    setCurrentUrl(url);
  };

  const handleClearPress = () => {
    setUrl("");
  };

  const handlePastePress = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (clipboardContent) {
        setUrl(clipboardContent);
      }
    } catch (error) {
      logger.error("DiscoveryScreen", "Failed to paste from clipboard:", error);
    }
  };

  const handleBackPress = () => {
    webViewRef.current?.goBack();
  };

  const handleForwardPress = () => {
    webViewRef.current?.goForward();
  };

  const handleRefreshPress = () => {
    webViewRef.current?.reload();
  };

  const handleMessage = useCallback((event: any) => {
    logger.debug("DiscoveryScreen", "Received RAW event from dApp:", event);
    logger.debug("DiscoveryScreen", "Received RAW event.nativeEvent from dApp:", event.nativeEvent);
    logger.debug("DiscoveryScreen", "Received RAW event.nativeEvent.data from dApp:", event.nativeEvent.data);

    try {
      const data = JSON.parse(event.nativeEvent.data);
      logger.debug("DiscoveryScreen", "Received JSON message from dApp:", data);
    } catch (error) {
      logger.debug("DiscoveryScreen", "Received RAW message from dApp:", event.nativeEvent.data);
    }
  }, []);

  const handleNavigationStateChange = useCallback((navState: any) => {
    logger.debug("DiscoveryScreen", "handleNavigationStateChange:", {
      navState
    });

    const { url: newUrl, loading, title, canGoBack: newCanGoBack, canGoForward: newCanGoForward } = navState;
    
    setCanGoBack(newCanGoBack);
    setCanGoForward(newCanGoForward);
    
    // Log URL changes
    if (newUrl !== currentUrl) {
      logger.debug("DiscoveryScreen", "URL changed:", {
        from: currentUrl,
        to: newUrl,
        title,
        loading
      });
    }

    // Check for deep links or custom protocols
    if (newUrl && !newUrl.startsWith('http')) {
      logger.debug("DiscoveryScreen", "Deep link or custom protocol detected:", newUrl);
    }
  }, [currentUrl]);

  return (
    <BaseLayout insets={{ bottom: false }}>
      <View className="flex-1">
        <Display sm style={{ alignSelf: "center", marginBottom: 16 }}>
          {t("discovery.title")}
        </Display>
        
        <View className="flex-row mb-4 gap-2">
          <View className="flex-1 flex-row items-center border border-gray-300 rounded-lg bg-white">
            <TextInput
              className="flex-1 h-10 px-3"
              value={url}
              onChangeText={setUrl}
              placeholder="Enter dApp URL"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {url.length > 0 && (
              <Button
                onPress={handleClearPress}
                secondary
                icon={<Icon.X />}
              />
            )}
            <Button
              onPress={handlePastePress}
              secondary
              icon={<Icon.Clipboard />}
            />
          </View>
          <Button onPress={handleGoPress} sm>
            Go
          </Button>
        </View>

        <View className="flex-row items-center justify-between mb-2 px-2">
          <View className="flex-row gap-2">
            <Button
              onPress={handleBackPress}
              secondary
              disabled={!canGoBack}
              icon={<Icon.ArrowLeft />}
            />
            <Button
              onPress={handleForwardPress}
              secondary
              disabled={!canGoForward}
              icon={<Icon.ArrowRight />}
            />
            <Button
              onPress={handleRefreshPress}
              secondary
              icon={<Icon.RefreshCw01 />}
            />
          </View>
          <View className="flex-1 mx-2">
            <TextInput
              className="text-sm text-gray-600"
              value={currentUrl}
              editable={false}
              numberOfLines={1}
            />
          </View>
        </View>

        {isLoading && (
          <ActivityIndicator
            className="absolute top-1/2 left-1/2 -translate-x-5 -translate-y-5 z-10"
            size="large"
            color="#0000ff"
          />
        )}

        {/* <WebView source={{ uri: currentUrl }} style={{ flex: 1 }} /> */}

        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          className="flex-1 bg-white"
          // style={{ flex: 1 }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          // onError={() => setIsLoading(false)}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          originWhitelist={['*']}
          webviewDebuggingEnabled={true}
          // injectedJavaScript={SCRIPTS_TO_INJECT}

          injectedJavaScript={`
            window.addEventListener('message', function(event) {
              window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
            });
            true;
          `}

          // injectedJavaScript={`
          //   ${webviewJS.postMessage}
          // `}

          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          // applicationNameForUserAgent={USER_AGENT_APPLICATION_NAME}
          automaticallyAdjustContentInsets
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInset={{ bottom: 0, left: 0, right: 0, top: 0 }}
          fraudulentWebsiteWarningEnabled
          mediaPlaybackRequiresUserAction
          onError={(error) => console.log("> > > > > > ERROR XXXXXXXXX", error)}
          renderLoading={() => <></>}

          // userAgent={USER_AGENT[isIOS ? 'IOS' : 'ANDROID']}
          // Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148
          // 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
          // userAgent={"Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1"}
          // userAgent={"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"}
          // userAgent={"Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1"}
        />
      </View>
    </BaseLayout>
  );
};
