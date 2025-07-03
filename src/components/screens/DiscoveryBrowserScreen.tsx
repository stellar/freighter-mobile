import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useBrowserTabsStore, BrowserTab } from "ducks/browserTabs";
import useColors from "hooks/useColors";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

const DEFAULT_URL = "https://stellar.org";

export const DiscoveryBrowserScreen: React.FC<DiscoveryScreenProps> = ({ 
  navigation, 
}) => {
  const { themeColors } = useColors();
  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [showTabs, setShowTabs] = useState(false);

  const { 
    tabs, 
    activeTabId, 
    addTab, 
    closeTab, 
    setActiveTab, 
    updateTab,
    closeAllTabs 
  } = useBrowserTabsStore();

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Initialize with first tab if none exists
  useEffect(() => {
    if (tabs.length === 0) {
      addTab(DEFAULT_URL);
    }
  }, []);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
    }
  }, [activeTab]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    if (activeTabId) {
      updateTab(activeTabId, {
        url: navState.url,
        title: navState.title || "New Tab",
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
        isLoading: navState.loading,
      });
    }
  }, [activeTabId, updateTab]);

  const handleGoBack = () => {
    if (activeTab?.canGoBack) {
      webViewRef.current?.goBack();
    }
  };

  const handleGoForward = () => {
    if (activeTab?.canGoForward) {
      webViewRef.current?.goForward();
    }
  };

  const handleRefresh = () => {
    webViewRef.current?.reload();
  };

  const handleNewTab = () => {
    addTab(DEFAULT_URL);
  };

  const handleCloseTab = (tabId: string) => {
    closeTab(tabId);
    // If it's the last tab, open a default tab
    if (tabs.length === 1) {
      handleNewTab();
    }
  };

  const handleSwitchTab = (tabId: string) => {
    setActiveTab(tabId);
    setShowTabs(false);
  };

  const handleUrlSubmit = () => {
    if (!activeTabId) return;

    let url = inputUrl.trim();
    
    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    updateTab(activeTabId, { url });
    webViewRef.current?.injectJavaScript(`window.location.href = "${url}";`);
  };

  const handleSettings = () => {
    Alert.alert(
      "Browser Settings",
      "Settings",
      [
        { text: "Close All Tabs", onPress: closeAllTabs },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  if (!activeTab) {
    return (
      <BaseLayout>
        <View className="flex-1 justify-center items-center">
          <Text>Loading...</Text>
        </View>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout insets={{ top: true, bottom: false, left: false, right: false }}>
      {/* Top URL Bar */}
      <View className="flex-row items-center p-4 bg-background-primary border-b border-border-default">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="p-2 mr-2"
        >
          <Icon.X color={themeColors.base[1]} />
        </TouchableOpacity>
        
        <TextInput
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={handleUrlSubmit}
          placeholder="Enter URL or search..."
          className="flex-1 px-3 py-2 bg-background-secondary rounded-lg text-foreground-primary"
          placeholderTextColor={themeColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        
        <TouchableOpacity 
          onPress={handleRefresh}
          className="p-2 ml-2"
          disabled={activeTab.isLoading}
        >
          <Icon.RefreshCcw01 
            color={activeTab.isLoading ? themeColors.text.secondary : themeColors.base[1]} 
          />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      {tabs.length > 1 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="bg-background-secondary border-b border-border-default"
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => handleSwitchTab(tab.id)}
              className={`flex-row items-center px-3 py-2 mr-1 ${
                tab.id === activeTabId ? 'bg-background-primary' : ''
              }`}
            >
              <Text 
                sm 
                className={`mr-2 ${tab.id === activeTabId ? 'text-foreground-primary' : 'text-foreground-secondary'}`}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
              <TouchableOpacity
                onPress={() => handleCloseTab(tab.id)}
                className="p-1"
              >
                <Icon.X size={12} color={themeColors.text.secondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* WebView */}
      <View className="flex-1">
        <WebView
          ref={webViewRef}
          source={{ uri: activeTab.url }}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          allowsBackForwardNavigationGestures={true}
          // Handle WalletConnect deep links
          onShouldStartLoadWithRequest={(request) => {
            // Handle WalletConnect URIs
            if (request.url.startsWith('wc:')) {
              // Handle WalletConnect connection
              console.log('WalletConnect URI detected:', request.url);
              return false;
            }
            return true;
          }}
        />
      </View>

      {/* Bottom Navigation Bar */}
      <View className="flex-row items-center justify-between p-4 bg-background-primary border-t border-border-default">
        <TouchableOpacity 
          onPress={handleGoBack}
          disabled={!activeTab.canGoBack}
          className="p-3"
        >
          <Icon.ArrowLeft 
            color={activeTab.canGoBack ? themeColors.base[1] : themeColors.text.secondary} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleGoForward}
          disabled={!activeTab.canGoForward}
          className="p-3"
        >
          <Icon.ArrowRight 
            color={activeTab.canGoForward ? themeColors.base[1] : themeColors.text.secondary} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleNewTab}
          className="p-3"
        >
          <Icon.Plus color={themeColors.base[1]} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleSettings}
          className="p-3"
        >
          <Icon.Settings01 color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>
    </BaseLayout>
  );
};