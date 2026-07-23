import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface CollapsibleCollectionHeaderProps {
  /** Collection name shown on the left. */
  collectionName: string;
  /** Number of collectibles in the collection, shown in the count badge. */
  count: number;
  /** Whether the collection is currently expanded (controlled by the parent). */
  isExpanded: boolean;
  /** Called when the header row is pressed to toggle expansion. */
  onToggle: () => void;
  /** Optional test ID for the header touchable. */
  testID?: string;
  /**
   * Render a gray divider line filling the space between the title and the count
   * badge (used by the Send flow to match its previous list header).
   */
  showDivider?: boolean;
}

/**
 * CollapsibleCollectionHeader Component
 *
 * The shared, tappable header row for a collectibles collection: the collection
 * name, a count badge, and a chevron indicating expanded/collapsed state.
 * Pressing anywhere on the row toggles the collection. The component is
 * controlled — the expanded state and its toggling live in the parent — so it
 * can front different bodies (the Home 2-column grid, the Send vertical list).
 *
 * The count badge is a perfect 24x24 circle for single-character counts and
 * grows into a 24px-tall pill for two or more characters.
 */
export const CollapsibleCollectionHeader: React.FC<
  CollapsibleCollectionHeaderProps
> = ({
  collectionName,
  count,
  isExpanded,
  onToggle,
  testID,
  showDivider = false,
}) => {
  const { themeColors } = useColors();

  const countLabel = String(count);
  const isSingleCharCount = countLabel.length <= 1;

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between"
      delayPressIn={DEFAULT_PRESS_DELAY}
      // Extend the tap target to the ~48px minimum without changing the row's
      // visual height/spacing (content is only ~24px tall).
      hitSlop={{ top: 12, bottom: 12 }}
      onPress={onToggle}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={`${collectionName}, ${countLabel}`}
    >
      {showDivider ? (
        <Text md medium secondary numberOfLines={1} style={{ flexShrink: 1 }}>
          {collectionName}
        </Text>
      ) : (
        <Text md medium secondary style={{ flex: 1 }}>
          {collectionName}
        </Text>
      )}
      {showDivider && (
        <View
          className="flex-1 h-[1px] mx-3 bg-gray-3"
          testID="collection-header-divider"
        />
      )}
      <View className="flex-row items-center gap-2">
        <View
          className={`flex-row items-center justify-center h-[24px] rounded-full border bg-gray-3 border-gray-6 ${
            isSingleCharCount ? "w-[24px]" : "min-w-[24px] px-2"
          }`}
        >
          <Text sm semiBold color={themeColors.gray[11]} textAlign="center">
            {countLabel}
          </Text>
        </View>
        {isExpanded ? (
          <Icon.ChevronUp size={16} color={themeColors.text.primary} />
        ) : (
          <Icon.ChevronDown size={16} color={themeColors.text.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

CollapsibleCollectionHeader.displayName = "CollapsibleCollectionHeader";
