import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

const CLOSE_ICON_SIZE = 24;
const CLOSE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Header layouts:
 * - `inline`: title and X on one row.
 * - `stacked`: optional leading element and X on top, title below.
 * - `centered`: centered title, X on the right.
 */
export type BottomSheetHeaderLayout = "inline" | "stacked" | "centered";

export interface BottomSheetHeaderProps {
  title?: string;
  /** Defaults to `stacked` when `leading` is set, otherwise `inline`. */
  layout?: BottomSheetHeaderLayout;
  /** Shown at the start of the top row, e.g. a token icon. Stacked layout only. */
  leading?: React.ReactNode;
  /** Shows the X when set. */
  onClose?: () => void;
  /** Disables the X, e.g. while a save is in flight. */
  closeDisabled?: boolean;
  closeTestID?: string;
  titleTestID?: string;
}

/**
 * Shared bottom sheet header: a title and a plain X in one of three layouts.
 * Renders nothing without a title, leading element or `onClose`. Adds no
 * spacing below; the content sets the gap.
 */
export const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  title,
  layout,
  leading,
  onClose,
  closeDisabled,
  closeTestID,
  titleTestID,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const resolvedLayout: BottomSheetHeaderLayout =
    layout ?? (leading ? "stacked" : "inline");

  if (!title && !leading && !onClose) {
    return null;
  }

  const closeButton = onClose ? (
    <TouchableOpacity
      onPress={onClose}
      disabled={closeDisabled}
      hitSlop={CLOSE_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t("common.close")}
      testID={closeTestID}
    >
      <Icon.X size={CLOSE_ICON_SIZE} color={themeColors.text.primary} />
    </TouchableOpacity>
  ) : null;

  const titleText = title ? (
    <Text
      lg
      semiBold
      primary
      textAlign={resolvedLayout === "centered" ? "center" : "left"}
      testID={titleTestID}
    >
      {title}
    </Text>
  ) : null;

  if (resolvedLayout === "stacked") {
    const hasTopRow = !!leading || !!closeButton;

    return (
      <View className="w-full gap-[16px]">
        {hasTopRow && (
          <View className="w-full flex-row items-center justify-between">
            {/* Keeps the X on the right when nothing leads. */}
            <View className="flex-row items-center">{leading}</View>
            {closeButton}
          </View>
        )}
        {titleText}
      </View>
    );
  }

  if (resolvedLayout === "centered") {
    return (
      <View className="w-full flex-row items-center justify-center">
        <View className="flex-1 px-[32px]">{titleText}</View>
        {closeButton && <View className="absolute right-0">{closeButton}</View>}
      </View>
    );
  }

  return (
    <View className="w-full flex-row items-center justify-between gap-[16px]">
      <View className="flex-1">{titleText}</View>
      {closeButton}
    </View>
  );
};

export interface PinnedBottomSheetHeaderProps extends BottomSheetHeaderProps {
  /** Space between the header and the content below it. Defaults to 24pt. */
  spaceBelow?: 16 | 24;
}

/**
 * `BottomSheetHeader` for the wrapper's `scrollViewHeaderComponent`: padded
 * 24pt on the sides and top, with an opaque background so the content
 * scrolling underneath doesn't show through.
 */
export const PinnedBottomSheetHeader: React.FC<
  PinnedBottomSheetHeaderProps
> = ({ spaceBelow = 24, ...headerProps }) => (
  <View
    className={`w-full bg-background-primary px-6 pt-[24px] ${
      spaceBelow === 16 ? "pb-[16px]" : "pb-[24px]"
    }`}
  >
    <BottomSheetHeader {...headerProps} />
  </View>
);
