import ProtocolRow from "components/screens/DiscoveryScreen/components/ProtocolRow";
import SectionTitle from "components/screens/DiscoveryScreen/components/SectionTitle";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";

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

interface MemoizedProtocolRowProps {
  item: VerticalListItem;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
}

const MemoizedProtocolRow: React.FC<MemoizedProtocolRowProps> = React.memo(
  ({ item, onItemOpen, onItemPress }) => {
    const handleOpen = useCallback(() => onItemOpen(item), [onItemOpen, item]);
    const handlePress = useCallback(
      () => onItemPress(item),
      [onItemPress, item],
    );

    return (
      <ProtocolRow
        name={item.name}
        subtitle={item.subtitle}
        iconUrl={item.iconUrl}
        onOpen={handleOpen}
        onPress={handlePress}
      />
    );
  },
);

MemoizedProtocolRow.displayName = "MemoizedProtocolRow";

interface VerticalListSectionProps {
  title: string;
  items: VerticalListItem[];
  onTitlePress: () => void;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
}

const VerticalListSection: React.FC<VerticalListSectionProps> = React.memo(
  ({ title, items, onTitlePress, onItemOpen, onItemPress }) => {
    const visibleItems = useMemo(
      () => items.slice(0, MAX_VISIBLE_ITEMS),
      [items],
    );

    if (visibleItems.length === 0) return null;

    return (
      <View
        className="mt-8"
        style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
      >
        <SectionTitle title={title} onPress={onTitlePress} className="mb-5" />

        <View className="gap-5">
          {visibleItems.map((item) => (
            <MemoizedProtocolRow
              key={item.id}
              item={item}
              onItemOpen={onItemOpen}
              onItemPress={onItemPress}
            />
          ))}
        </View>
      </View>
    );
  },
);

VerticalListSection.displayName = "VerticalListSection";

export default VerticalListSection;
