import { TrendingCarousel, TrendingItem } from "components/TrendingCarousel";
import SectionTitle from "components/screens/DiscoveryScreen/components/SectionTitle";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import React from "react";
import { View } from "react-native";

interface TrendingCarouselSectionProps {
  title: string;
  items: TrendingItem[];
  onTitlePress?: () => void;
  onItemPress: (item: TrendingItem) => void;
}

const TrendingCarouselSection: React.FC<TrendingCarouselSectionProps> =
  React.memo(({ title, items, onTitlePress, onItemPress }) => {
    if (items.length === 0) return null;

    return (
      <View>
        <SectionTitle
          title={title}
          onPress={onTitlePress}
          // Flush with the top of the list, right under the nav bar.
          className="mb-3"
          style={{ paddingLeft: pxValue(DEFAULT_PADDING) }}
        />
        <TrendingCarousel items={items} onItemPress={onItemPress} />
      </View>
    );
  });

TrendingCarouselSection.displayName = "TrendingCarouselSection";

export default TrendingCarouselSection;
