import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { logger } from "config/logger";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState, useCallback } from "react";
import { View, TextInput, ActivityIndicator, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import Clipboard from "@react-native-clipboard/clipboard";
import Icon from "components/sds/Icon";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = () => {
  const { t } = useAppTranslation();
  const [url, setUrl] = useState("https://aqua.network/");
  const [currentUrl, setCurrentUrl] = useState("https://aqua.network/");
  const [isLoading, setIsLoading] = useState(false);

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

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      logger.debug("DiscoveryScreen", "Received JSON message from dApp:", data);
    } catch (error) {
      logger.debug("DiscoveryScreen", "Received RAW message from dApp:", event.nativeEvent.data);
    }
  }, []);

  const handleNavigationStateChange = useCallback((navState: any) => {
    const { url: newUrl, loading, title } = navState;
    
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
        <Display sm className="self-center mb-4">
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
          <Button title="Go" onPress={handleGoPress} className="w-[60px]" />
        </View>

        {isLoading && (
          <ActivityIndicator
            className="absolute top-1/2 left-1/2 -translate-x-5 -translate-y-5 z-10"
            size="large"
            color="#0000ff"
          />
        )}

        <WebView
          source={{ uri: currentUrl }}
          className="flex-1 bg-white"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          injectedJavaScript={`
            window.addEventListener('message', function(event) {
              window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
            });
            true;
          `}
        />
      </View>
    </BaseLayout>
  );
};
