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
        <View style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}>
          <ProtocolRow
            name={item.name}
            subtitle={item.subtitle}
            iconUrl={item.iconUrl}
            onOpen={() => onItemOpen(item)}
            onPress={() => onItemPress(item)}
          />
        </View>
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
