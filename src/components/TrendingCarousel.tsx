import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { PALETTE } from "config/theme";
import { pxValue } from "helpers/dimensions";
import React, { useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from "react-native";

// =============================================================================
// Constants
// =============================================================================

const CARD_WIDTH = 288;
const CARD_HEIGHT = 162;
const CARD_BORDER_RADIUS = 12;
const CARD_GAP = 16;

// =============================================================================
// Types
// =============================================================================

interface TrendingItem {
  id: string;
  title: string;
  category?: string;
  imageSource: ImageSourcePropType;
}

interface TrendingCardProps {
  item: TrendingItem;
  onPress: (item: TrendingItem) => void;
}

interface TrendingCarouselProps {
  items: TrendingItem[];
  onItemPress: (item: TrendingItem) => void;
  onScrollEnd: () => Promise<void>;
}

// =============================================================================
// TrendingCard
// =============================================================================

const TrendingCard: React.FC<TrendingCardProps> = React.memo(
  ({ item, onPress }) => {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [onPress, item]);

    return (
      <TouchableOpacity
        className="overflow-hidden"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: CARD_BORDER_RADIUS,
          marginRight: CARD_GAP,
        }}
        activeOpacity={0.6}
        onPress={handlePress}
        delayPressIn={DEFAULT_PRESS_DELAY}
      >
        <Image
          source={item.imageSource}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />

        {/* Using PALETTE.dark directly instead of useColors() because text is
            overlaid on a dark static background image, so it must always be
            light regardless of the active theme */}
        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-[16px] pb-[16px]">
          <Text md medium color={PALETTE.dark.gray[12]}>
            {item.title}
          </Text>
          {item.category && (
            <Text sm medium color={PALETTE.dark.gray[11]}>
              {item.category}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  },
);

TrendingCard.displayName = "TrendingCard";

// =============================================================================
// TrendingCarousel
// =============================================================================

const TrendingCarousel: React.FC<TrendingCarouselProps> = React.memo(
  ({ items, onItemPress, onScrollEnd }) => {
    const handleScrollEnd = useCallback(() => {
      onScrollEnd();
    }, [onScrollEnd]);

    const renderItem = useCallback(
      // eslint-disable-next-line react/no-unused-prop-types
      ({ item }: { item: TrendingItem }) => (
        <TrendingCard item={item} onPress={onItemPress} />
      ),
      [onItemPress],
    );

    const contentContainerStyle = useMemo(
      () => ({
        paddingHorizontal: pxValue(DEFAULT_PADDING),
      }),
      [],
    );

    return (
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={contentContainerStyle}
      />
    );
  },
);

TrendingCarousel.displayName = "TrendingCarousel";

export { TrendingCard, TrendingCarousel };
export type { TrendingItem };
export default TrendingCarousel;
