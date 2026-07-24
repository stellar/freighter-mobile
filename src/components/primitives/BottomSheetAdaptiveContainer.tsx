import {
  BOTTOM_SHEET_CONTENT_GAP,
  BOTTOM_SHEET_CONTENT_TOP_PADDING,
  BOTTOM_SHEET_FLOATING_MARGIN,
  BOTTOM_SHEET_MAX_HEIGHT_RATIO,
} from "config/constants";
import { calculateScrollableMaxHeight } from "helpers/bottomSheet";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BottomSheetAdaptiveContainerProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  sheetMaxHeightRatio?: number;
  topPaddingPx?: number;
  bottomPaddingPx?: number;
  contentGapPx?: number;
  /**
   * Set when the host sheet uses the floating variant. A floating sheet is
   * lifted off the bottom by its inset, so gorhom gives it a shorter container;
   * this reserves that inset in the height budget so scroll content fits the
   * card instead of overflowing its rounded bottom.
   */
  floating?: boolean;
}

/**
 * A container that adapts to the height of the bottom sheet. This container is used mainly for scrollable bottom sheets, that might occupy more than 100% of set height,
 * so the content inside remains scrollable, but the BottomSheet can have a fixed header or snap height.
 *
 * Usage example:
 * @example
 * const SNAP_VALUE_PERCENT = 80;
 * <View className="flex-1">
 *    <BottomSheetAdaptiveContainer
 *      bottomPaddingPx={heightPercentageToDP(100 - SNAP_VALUE_PERCENT)}
 *      header={
 *        <Text>Header</Text>
 *      }
 *    >
 *      <BottomSheetScrollView
 *        className="w-full"
 *      >
 *        {content}
 *      </BottomSheetScrollView>
 *    </BottomSheetAdaptiveContainer>
 *  </View>
 *);
 *
 * @param {React.ReactNode} header - The header of the bottom sheet
 * @param {React.ReactNode} children - The children of the bottom sheet
 * @param {number} sheetMaxHeightRatio - The ratio of the bottom sheet height to the screen height
 * @param {number} topPaddingPx - The top padding of the bottom sheet
 * @param {number} bottomPaddingPx - The bottom padding of the bottom sheet
 * @param {number} contentGapPx - The gap between the header and the content of the bottom sheet
 */
const BottomSheetAdaptiveContainer: React.FC<
  BottomSheetAdaptiveContainerProps
> = ({
  header,
  children,
  sheetMaxHeightRatio = BOTTOM_SHEET_MAX_HEIGHT_RATIO,
  topPaddingPx = BOTTOM_SHEET_CONTENT_TOP_PADDING,
  bottomPaddingPx = 0,
  contentGapPx = BOTTOM_SHEET_CONTENT_GAP,
  floating = false,
}) => {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  // A floating sheet's gorhom container is shorter by its bottom inset
  // (safe-area bottom + the floating margin); reserve that here so scroll
  // content fits the card instead of overflowing its rounded bottom.
  const reservedVerticalPx = floating
    ? insets.bottom + BOTTOM_SHEET_FLOATING_MARGIN
    : 0;
  // The header carries a `contentGapPx` marginBottom that the base height calc
  // omits. On a floating card that must fit exactly, fold it into the header
  // height so the scroll area accounts for it. (Classic sheets tolerate the
  // omission because gorhom clips their overflow.)
  const effectiveHeaderHeightPx =
    floating && header ? headerHeight + contentGapPx : headerHeight;
  const maxContentHeight = useMemo(
    () =>
      calculateScrollableMaxHeight({
        headerHeightPx: effectiveHeaderHeightPx,
        sheetMaxHeightRatio,
        topPaddingPx,
        bottomPaddingPx,
        reservedVerticalPx,
      }),
    [
      effectiveHeaderHeightPx,
      bottomPaddingPx,
      sheetMaxHeightRatio,
      topPaddingPx,
      reservedVerticalPx,
    ],
  );

  return (
    <View className="w-full">
      {header ? (
        <View
          className="w-full"
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          style={{
            marginBottom: contentGapPx,
          }}
        >
          {header}
        </View>
      ) : null}

      <View
        style={{
          maxHeight: maxContentHeight,
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default BottomSheetAdaptiveContainer;
