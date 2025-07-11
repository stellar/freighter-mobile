import { App } from "components/sds/App";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  TRENDING_SITES,
  TrendingSite,
} from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { getFaviconUrl } from "helpers/browser";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { View, FlatList, TouchableOpacity } from "react-native";

interface DiscoveryHomepageProps {
  tabId: string;
}

const DiscoveryHomepage: React.FC<DiscoveryHomepageProps> = ({ tabId }) => {
  const { themeColors } = useColors();
  const { goToPage } = useBrowserTabsStore();

  const handleSitePress = (url: string) => {
    goToPage(tabId, url);
  };

  const renderSiteItem = ({ item }: { item: TrendingSite }) => (
    <TouchableOpacity
      className="mr-3 items-center"
      onPress={() => handleSitePress(item.url)}
    >
      <View
        className="w-[76px] h-[76px] rounded-xl justify-center items-center mb-2"
        style={{ backgroundColor: themeColors.background.tertiary }}
      >
        <App appName={item.name} favicon={getFaviconUrl(item.url)} size="lg" />
      </View>
      <Text
        sm
        medium
        numberOfLines={2}
        style={{ maxWidth: 76, textAlign: "center" }}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background-primary">
      <View>
        <View
          className="flex-row items-center gap-2 mb-3"
          style={{ paddingLeft: pxValue(DEFAULT_PADDING) }}
        >
          <Icon.Lightning01 color={themeColors.gold[9]} size={16} />
          <Text md medium>
            Trending
          </Text>
        </View>

        <FlatList
          horizontal
          data={TRENDING_SITES}
          renderItem={renderSiteItem}
          keyExtractor={(item) => item.url}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: pxValue(DEFAULT_PADDING),
          }}
        />
      </View>
    </View>
  );
};

export default DiscoveryHomepage;
