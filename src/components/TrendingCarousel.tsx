import TrendingCardImage from "components/TrendingCardImage";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { PALETTE } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";

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
  backgroundUrl?: string;
}

interface TrendingCardProps {
  item: TrendingItem;
  onPress: (item: TrendingItem) => void;
}

interface TrendingCarouselProps {
  items: TrendingItem[];
  onItemPress: (item: TrendingItem) => void;
}

// =============================================================================
// TrendingCard
// =============================================================================

const TrendingCard: React.FC<TrendingCardProps> = React.memo(
  ({ item, onPress }) => {
    const { themeColors } = useColors();
    const [showPlaceholder, setShowPlaceholder] = useState(!item.backgroundUrl);

    const handlePress = useCallback(() => {
      onPress(item);
    }, [onPress, item]);

    const handleShowPlaceholder = useCallback(() => {
      setShowPlaceholder(true);
    }, []);

    const handleHidePlaceholder = useCallback(() => {
      setShowPlaceholder(false);
    }, []);

    // Use dark palette colors when image is visible (light text on dark image),
    // theme-aware colors when showing placeholder
    const titleColor = showPlaceholder
      ? themeColors.text.primary
      : PALETTE.dark.gray[12];
    const categoryColor = showPlaceholder
      ? themeColors.text.secondary
      : PALETTE.dark.gray[11];

    return (
      <TouchableOpacity
        className="overflow-hidden"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: CARD_BORDER_RADIUS,
          marginRight: CARD_GAP,
          backgroundColor: themeColors.background.tertiary,
        }}
        activeOpacity={0.6}
        onPress={handlePress}
        delayPressIn={DEFAULT_PRESS_DELAY}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <TrendingCardImage
          backgroundUrl={item.backgroundUrl}
          showPlaceholder={showPlaceholder}
          onShowPlaceholder={handleShowPlaceholder}
          onHidePlaceholder={handleHidePlaceholder}
        />

        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-[16px] pb-[16px]">
          <Text md medium color={titleColor}>
            {item.title}
          </Text>
          {item.category && (
            <Text sm medium color={categoryColor}>
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
  ({ items, onItemPress }) => {
    const renderItem = useCallback(
      // eslint-disable-next-line react/no-unused-prop-types
      ({ item }: { item: TrendingItem }) => (
        <TrendingCard item={item} onPress={onItemPress} />
      ),
      [onItemPress],
    );

    const keyExtractor = useCallback((item: TrendingItem) => item.id, []);

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
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews
        contentContainerStyle={contentContainerStyle}
      />
    );
  },
);

TrendingCarousel.displayName = "TrendingCarousel";

export { TrendingCard, TrendingCarousel };
export type { TrendingItem };
export default TrendingCarousel;
