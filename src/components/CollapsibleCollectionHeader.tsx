import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { fsValue, pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/** Figma's chevron is 12pt wide, drawn with a 1.5pt stroke. */
const CHEVRON_SIZE = 12;
const CHEVRON_STROKE_WIDTH = 1.5;

/**
 * Figma's chevron button: 28pt tall, with the chevron 8pt in from each side.
 * A style, not classes, so it scales with the 12pt chevron it frames.
 */
const CHEVRON_BOX_STYLE = {
  height: pxValue(28),
  paddingHorizontal: pxValue(8),
};

/**
 * The count sits on Figma Text/SM's 20pt line height, not `Text`'s 22:
 * `TEXT_SIZES.sm` stays 14/22 for the rest of the app.
 */
const COUNT_STYLE = { lineHeight: fsValue(20) };

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
  /**
   * Render the collection name in the primary text color (used by the Home
   * Collectibles tab); defaults to the secondary color the Send flow keeps.
   */
  titlePrimary?: boolean;
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
 * The count badge is sized to its text, so a single digit comes out nearly
 * round and a longer count a pill, and it is 24pt tall like Figma's. The
 * chevron is 12pt, in a 28pt-tall box.
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
  titlePrimary = false,
}) => {
  const { themeColors } = useColors();

  const countLabel = String(count);
  const Chevron = isExpanded ? Icon.ChevronUp : Icon.ChevronDown;

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between"
      delayPressIn={DEFAULT_PRESS_DELAY}
      // Extend the tap target to the ~48pt minimum without changing the row's
      // visual height/spacing (the row is only 28pt tall).
      hitSlop={{ top: 12, bottom: 12 }}
      onPress={onToggle}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={`${collectionName}, ${countLabel}`}
    >
      {showDivider ? (
        <Text
          md
          medium
          primary={titlePrimary}
          secondary={!titlePrimary}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {collectionName}
        </Text>
      ) : (
        <Text
          md
          medium
          primary={titlePrimary}
          secondary={!titlePrimary}
          style={{ flex: 1 }}
        >
          {collectionName}
        </Text>
      )}
      {showDivider && (
        <View
          className="flex-1 h-[1px] mx-3 bg-gray-3"
          testID="collection-header-divider"
        />
      )}
      <View className="flex-row items-center gap-[8px]">
        {/* 7pt by 1pt of padding, not Figma's 8pt by 2pt: Figma draws the 1pt
            stroke inside a 24pt-tall badge (20pt of text and 2pt of padding),
            and a border adds to the box here, so it takes the last point. */}
        <View className="flex-row items-center justify-center rounded-full border bg-gray-3 border-gray-6 px-[7px] py-[1px]">
          <Text
            sm
            semiBold
            color={themeColors.gray[11]}
            textAlign="center"
            style={COUNT_STYLE}
          >
            {countLabel}
          </Text>
        </View>
        <View className="items-center justify-center" style={CHEVRON_BOX_STYLE}>
          <Chevron
            size={CHEVRON_SIZE}
            strokeWidth={CHEVRON_STROKE_WIDTH}
            color={themeColors.gray[9]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

CollapsibleCollectionHeader.displayName = "CollapsibleCollectionHeader";
