import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Alert, ScrollView, Animated } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { MainTabStackParamList, MAIN_TAB_ROUTES } from "config/routes";
import { useBrowserTabsStore, BrowserTab } from "ducks/browserTabs";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";

type DiscoveryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_DISCOVERY
>;

const DEFAULT_URL = "https://stellar.org";

export const DiscoveryBrowserScreen: React.FC<DiscoveryScreenProps> = ({ 
  navigation, 
}) => {
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [showTabs, setShowTabs] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
  }, [tabs.length, addTab]);

  // Update input URL when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
    }
  }, [activeTab]);

  // Animate tab overview screen
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showTabs ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showTabs, fadeAnim]);

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

  const handleShowTabs = () => {
    setShowTabs(true);
  };

  const handleCloseTabOverview = () => {
    setShowTabs(false);
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

  // Tab Overview Screen (Rainbow-style)
  if (showTabs) {
    return (
      <BaseLayout insets={{ top: true, bottom: false, left: false, right: false }}>
        <Animated.View 
          style={{ 
            flex: 1, 
            opacity: fadeAnim,
            backgroundColor: themeColors.background.primary 
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border-default">
            <TouchableOpacity onPress={handleCloseTabOverview}>
              <Icon.X color={themeColors.base[1]} />
            </TouchableOpacity>
            <Text lg semiBold>
              {tabs.length} Tab{tabs.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={handleNewTab}>
              <Icon.Plus color={themeColors.base[1]} />
            </TouchableOpacity>
          </View>

          {/* Tabs Grid */}
          <ScrollView className="flex-1 p-4">
            <View className="flex-row flex-wrap justify-between">
              {tabs.map((tab, index) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleSwitchTab(tab.id)}
                  className={`w-[48%] mb-4 rounded-lg overflow-hidden ${
                    tab.id === activeTabId ? 'border-2 border-primary' : 'border border-border-default'
                  }`}
                >
                  {/* Tab Preview */}
                  <View className="h-32 bg-background-secondary justify-center items-center">
                    <Icon.Browser size={32} color={themeColors.text.secondary} />
                  </View>
                  
                  {/* Tab Info */}
                  <View className="p-3 bg-background-primary">
                    <Text sm semiBold numberOfLines={1} className="mb-1">
                      {tab.title}
                    </Text>
                    <Text xs secondary numberOfLines={1} className="mb-2">
                      {tab.url}
                    </Text>
                    
                    {/* Tab Actions */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center">
                        {tab.id === activeTabId && (
                          <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                        )}
                        <Text xs secondary>
                          {tab.id === activeTabId ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      
                      {tabs.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleCloseTab(tab.id)}
                          className="p-1"
                        >
                          <Icon.X size={12} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </BaseLayout>
    );
  }

  // Main Browser Screen
  return (
    <BaseLayout insets={{ top: true, bottom: false, left: false, right: false }}>
      {/* Top URL Bar */}
      <View className="flex-row items-center gap-2 p-4 bg-background-primary border-b border-border-default">
        <Avatar size="sm"  publicAddress={account?.publicKey ?? ""} />
        
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
          className="p-2"
          disabled={activeTab.isLoading}
        >
          <Icon.RefreshCcw01 
            color={activeTab.isLoading ? themeColors.text.secondary : themeColors.base[1]} 
          />
        </TouchableOpacity>

        {/* Show Tabs Button */}
        <TouchableOpacity 
          onPress={handleShowTabs}
          className="p-2 relative"
        >
          <Icon.LayoutGrid01 color={themeColors.base[1]} />
          {tabs.length > 1 && (
            <View className="absolute -top-1 -right-1 bg-primary rounded-full w-5 h-5 justify-center items-center">
              <Text xs className="text-base-00">
                {tabs.length > 9 ? '9+' : tabs.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

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