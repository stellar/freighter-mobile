import {
  BOTTOM_SHEET_CONTENT_BOTTOM_PADDING,
  BOTTOM_SHEET_CONTENT_TOP_PADDING,
  BOTTOM_SHEET_MAX_HEIGHT_RATIO,
} from "config/constants";
import { Dimensions } from "react-native";

export interface BottomSheetMaxHeightOptions {
  headerHeightPx: number;
  sheetMaxHeightRatio?: number;
  topPaddingPx?: number;
  bottomPaddingPx?: number;
  /**
   * Vertical space the host sheet removes from the window before sizing (e.g.
   * a floating sheet's bottom inset). gorhom reduces a modal sheet's container
   * height by its insets, so this must be subtracted here too — otherwise
   * scroll content is sized for a taller card and overflows the shorter one.
   */
  reservedVerticalPx?: number;
}

export const DEFAULT_SHEET_MAX_HEIGHT_RATIO = 0.9;

export const calculateScrollableMaxHeight = (
  options: BottomSheetMaxHeightOptions,
): number => {
  const {
    headerHeightPx,
    sheetMaxHeightRatio = BOTTOM_SHEET_MAX_HEIGHT_RATIO,
    topPaddingPx = BOTTOM_SHEET_CONTENT_TOP_PADDING,
    bottomPaddingPx = BOTTOM_SHEET_CONTENT_BOTTOM_PADDING,
    reservedVerticalPx = 0,
  } = options;

  const windowHeight = Dimensions.get("window").height;

  const availableHeight =
    (windowHeight - reservedVerticalPx) * sheetMaxHeightRatio -
    headerHeightPx -
    topPaddingPx;

  const maxHeight = Math.max(0, availableHeight - bottomPaddingPx);

  return maxHeight;
};
