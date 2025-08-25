import {
  BOTTOM_SHEET_CONTENT_GAP,
  BOTTOM_SHEET_CONTENT_TOP_PADDING,
  BOTTOM_SHEET_MAX_HEIGHT_RATIO,
} from "config/constants";
import { calculateScrollableMaxHeight } from "helpers/bottomSheet";
import React, { useMemo, useState } from "react";
import { View } from "react-native";

interface BottomSheetAdaptiveContainerProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  sheetMaxHeightRatio?: number;
  topPaddingPx?: number;
  bottomPaddingPx?: number;
  contentGapPx?: number;
}

const BottomSheetAdaptiveContainer: React.FC<
  BottomSheetAdaptiveContainerProps
> = ({
  header,
  children,
  sheetMaxHeightRatio = BOTTOM_SHEET_MAX_HEIGHT_RATIO,
  topPaddingPx = BOTTOM_SHEET_CONTENT_TOP_PADDING,
  bottomPaddingPx = 0,
  contentGapPx = BOTTOM_SHEET_CONTENT_GAP,
}) => {
  const [headerHeight, setHeaderHeight] = useState(0);

  const maxContentHeight = useMemo(
    () =>
      calculateScrollableMaxHeight({
        headerHeightPx: headerHeight,
        sheetMaxHeightRatio,
        topPaddingPx,
        bottomPaddingPx,
      }),
    [headerHeight, bottomPaddingPx, sheetMaxHeightRatio, topPaddingPx],
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

      <View style={{ maxHeight: maxContentHeight }}>{children}</View>
    </View>
  );
};

export default BottomSheetAdaptiveContainer;
