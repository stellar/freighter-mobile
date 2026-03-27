import {
  CustomHeaderButton,
  DEFAULT_HEADER_BUTTON_SIZE,
} from "components/layout/CustomHeaderButton";
import ProtocolRow from "components/screens/DiscoveryScreen/components/ProtocolRow";
import { VerticalListItem } from "components/screens/DiscoveryScreen/components/VerticalListSection";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import React, { useCallback, useMemo } from "react";
import { View, FlatList } from "react-native";

const ITEM_HORIZONTAL_PADDING = pxValue(DEFAULT_PADDING);

interface ExpandedListItemProps {
  item: VerticalListItem;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
}

const ExpandedListItem: React.FC<ExpandedListItemProps> = React.memo(
  ({ item, onItemOpen, onItemPress }) => {
    const handleOpen = useCallback(() => onItemOpen(item), [onItemOpen, item]);
    const handlePress = useCallback(
      () => onItemPress(item),
      [onItemPress, item],
    );

    return (
      <View style={{ paddingHorizontal: ITEM_HORIZONTAL_PADDING }}>
        <ProtocolRow
          name={item.name}
          subtitle={item.subtitle}
          iconUrl={item.iconUrl}
          onOpen={handleOpen}
          onPress={handlePress}
        />
      </View>
    );
  },
);

ExpandedListItem.displayName = "ExpandedListItem";

interface ExpandedSectionViewProps {
  title: string;
  items: VerticalListItem[];
  onBack: () => void;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
  headerRight?: React.ReactNode;
}

const ExpandedSectionView: React.FC<ExpandedSectionViewProps> = React.memo(
  ({ title, items, onBack, onItemOpen, onItemPress, headerRight }) => {
    const renderItem = useCallback(
      // eslint-disable-next-line react/no-unused-prop-types
      ({ item }: { item: VerticalListItem }) => (
        <ExpandedListItem
          item={item}
          onItemOpen={onItemOpen}
          onItemPress={onItemPress}
        />
      ),
      [onItemOpen, onItemPress],
    );

    const keyExtractor = useCallback((item: VerticalListItem) => item.id, []);

    const contentContainerStyle = useMemo(
      () => ({
        paddingBottom: pxValue(DEFAULT_PADDING),
      }),
      [],
    );

    const itemSeparator = useCallback(
      () => <View style={{ height: pxValue(20) }} />,
      [],
    );

    return (
      <View className="flex-1 bg-background-primary">
        <View className="flex-row items-center justify-between px-6 pb-4 pt-4">
          <CustomHeaderButton position="left" onPress={onBack} />
          <Text md semiBold>
            {title}
          </Text>
          {headerRight ?? <View className={DEFAULT_HEADER_BUTTON_SIZE} />}
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          ItemSeparatorComponent={itemSeparator}
          removeClippedSubviews
        />
      </View>
    );
  },
);

ExpandedSectionView.displayName = "ExpandedSectionView";

export default ExpandedSectionView;
