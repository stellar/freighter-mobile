import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View, TextInput, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

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

  return (
    <BaseLayout insets={{ bottom: false }}>
      <View className="flex-1">
        <Display sm className="self-center mb-4">
          {t("discovery.title")}
        </Display>

        <View className="flex-row mb-4 gap-2">
          <TextInput
            className="flex-1 h-10 border border-gray-300 rounded-lg px-3 bg-white"
            value={url}
            onChangeText={setUrl}
            placeholder="Enter dApp URL"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
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
        />
      </View>
    </BaseLayout>
  );
};
