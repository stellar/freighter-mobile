import Shimmer from "components/sds/Shimmer";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

/** From the Figma "Data loading" frame: three 44pt rows, 24pt apart. */
export const HISTORY_SKELETON_ROW_COUNT = 3;
export const HISTORY_SKELETON_ROW_HEIGHT = 44;
export const HISTORY_SKELETON_ROW_GAP = 24;

/**
 * The history list's loading placeholder where the screen opts in. Sits in
 * the SectionList's empty slot like the spinner it replaces, so the list
 * element — and the header above it — never remounts.
 */
const HistorySkeletonRows: React.FC<{ width: number }> = ({ width }) => {
  const { t } = useAppTranslation();

  return (
    <View
      testID="history-skeleton"
      accessible
      accessibilityState={{ busy: true }}
      accessibilityLabel={t("history.loadingA11yLabel")}
      style={{ gap: pxValue(HISTORY_SKELETON_ROW_GAP) }}
    >
      {Array.from({ length: HISTORY_SKELETON_ROW_COUNT }, (_, index) => (
        <Shimmer
          key={index}
          testID="history-skeleton-row"
          width={width}
          height={pxValue(HISTORY_SKELETON_ROW_HEIGHT)}
        />
      ))}
    </View>
  );
};

export default HistorySkeletonRows;
