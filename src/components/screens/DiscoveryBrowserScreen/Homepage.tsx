import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { POPULAR_SITES, QUICK_ACTIONS } from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import useColors from "hooks/useColors";
import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";

interface HomepageProps {
  tabId: string;
}

const Homepage: React.FC<HomepageProps> = ({ tabId }) => {
  const { themeColors } = useColors();
  const { goToPage } = useBrowserTabsStore();

  const handleSitePress = (url: string) => {
    goToPage(tabId, url);
  };

  return (
    <ScrollView
      className="flex-1 bg-background-primary"
      contentContainerStyle={{ padding: 20 }}
    >
      {/* Welcome Section */}
      <View className="mb-8">
        <Text xl bold className="mb-2 text-text-primary">
          Welcome to Freighter
        </Text>
        <Text md className="text-text-secondary">
          Your gateway to the Stellar network
        </Text>
      </View>

      {/* Search Bar */}
      <View className="mb-8">
        <TouchableOpacity
          className="flex-row items-center p-4 bg-background-secondary rounded-lg border border-border-primary"
          onPress={() => goToPage(tabId, "https://www.google.com")}
        >
          <Icon.SearchLg size={20} color={themeColors.text.secondary} />
          <Text md className="ml-3 text-text-secondary">
            Search or enter website name
          </Text>
        </TouchableOpacity>
      </View>

      {/* Popular Sites */}
      <View className="mb-6">
        <Text lg semiBold className="mb-4 text-text-primary">
          Popular Sites
        </Text>
        <View className="flex-row flex-wrap justify-between">
          {POPULAR_SITES.map((site) => (
            <TouchableOpacity
              key={site.url}
              className="w-[48%] mb-4 p-4 bg-background-secondary rounded-lg border border-border-primary"
              onPress={() => handleSitePress(site.url)}
            >
              <View className="flex-row items-center">
                <Icon.Globe02 size={24} color={themeColors.primary} />
                <Text md semiBold className="ml-3 text-text-primary">
                  {site.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View>
        <Text lg semiBold className="mb-4 text-text-primary">
          Quick Actions
        </Text>
        <View className="space-y-3">
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.url}
              className="flex-row items-center p-4 bg-background-secondary rounded-lg border border-border-primary"
              onPress={() => handleSitePress(action.url)}
            >
              <Icon.Terminal size={20} color={themeColors.primary} />
              <Text md className="ml-3 text-text-primary">
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default Homepage;
