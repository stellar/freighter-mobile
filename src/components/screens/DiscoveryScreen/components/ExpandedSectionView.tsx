import ProtocolRow from "components/screens/DiscoveryScreen/components/ProtocolRow";
import { VerticalListItem } from "components/screens/DiscoveryScreen/components/VerticalListSection";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";

interface ExpandedSectionViewProps {
  title: string;
  items: VerticalListItem[];
  onBack: () => void;
  onItemOpen: (item: VerticalListItem) => void;
  onItemPress: (item: VerticalListItem) => void;
  onScrollEnd?: () => void;
}

const HEADER_BUTTON_SIZE = 24;

const ExpandedSectionView: React.FC<ExpandedSectionViewProps> = React.memo(
  ({ title, items, onBack, onItemOpen, onItemPress, onScrollEnd }) => {
    const { themeColors } = useColors();

    const handleBack = useCallback(() => {
      onBack();
    }, [onBack]);

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
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            delayPressIn={DEFAULT_PRESS_DELAY}
          >
            <Icon.ArrowLeft
              size={HEADER_BUTTON_SIZE}
              color={themeColors.base[1]}
            />
          </TouchableOpacity>
          <Text md semiBold>
            {title}
          </Text>
          <View style={{ width: HEADER_BUTTON_SIZE }} />
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          ItemSeparatorComponent={itemSeparator}
          onScrollEndDrag={onScrollEnd}
        />
      </View>
    );
  },
);

ExpandedSectionView.displayName = "ExpandedSectionView";

export default ExpandedSectionView;
