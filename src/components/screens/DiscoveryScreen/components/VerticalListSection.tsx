import ProtocolRow from "components/screens/DiscoveryScreen/components/ProtocolRow";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { View, TouchableOpacity } from "react-native";

export interface VerticalListItem {
  id: string;
  name: string;
  subtitle: string;
  iconUrl: string;
  websiteUrl: string;
  description: string;
  tags: string[];
}

const MAX_VISIBLE_ITEMS = 5;

interface VerticalListSectionProps {
  title: string;
  items: VerticalListItem[];
  onTitlePress: () => void;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
}

const VerticalListSection: React.FC<VerticalListSectionProps> = React.memo(
  ({ title, items, onTitlePress, onItemOpen, onItemPress }) => {
    const { themeColors } = useColors();

    const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);

    const handleTitlePress = useCallback(() => {
      onTitlePress();
    }, [onTitlePress]);

    if (visibleItems.length === 0) return null;

    return (
      <View
        className="mt-8"
        style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
      >
        <TouchableOpacity
          className="flex-row items-center gap-1 mb-5"
          onPress={handleTitlePress}
          delayPressIn={DEFAULT_PRESS_DELAY}
        >
          <Text md semiBold>
            {title}
          </Text>
          <Icon.ChevronRight size={16} color={themeColors.text.primary} />
        </TouchableOpacity>

        <View className="gap-5">
          {visibleItems.map((item) => (
            <ProtocolRow
              key={item.id}
              name={item.name}
              subtitle={item.subtitle}
              iconUrl={item.iconUrl}
              onOpen={() => onItemOpen(item)}
              onPress={() => onItemPress(item)}
            />
          ))}
        </View>
      </View>
    );
  },
);

VerticalListSection.displayName = "VerticalListSection";

export default VerticalListSection;
