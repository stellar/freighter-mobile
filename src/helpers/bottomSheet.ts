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
  footerHeightPx?: number;
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
    footerHeightPx = 0,
  } = options;

  const windowHeight = Dimensions.get("window").height;

  const availableHeight =
    windowHeight * sheetMaxHeightRatio -
    headerHeightPx -
    topPaddingPx -
    footerHeightPx;

  const maxHeight = Math.max(0, availableHeight - bottomPaddingPx);

  return maxHeight;
};
