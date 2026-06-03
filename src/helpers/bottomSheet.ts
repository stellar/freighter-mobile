import {
  BOTTOM_SHEET_CONTENT_BOTTOM_PADDING,
  BOTTOM_SHEET_CONTENT_TOP_PADDING,
  BOTTOM_SHEET_MAX_HEIGHT_RATIO,
} from "config/constants";
import { Dimensions, Keyboard } from "react-native";

/**
 * Resolves only after the keyboard has fully hidden, so a bottom sheet
 * presented next animates in at its final height instead of opening at the
 * keyboard-occluded position and visibly jumping down.
 *
 * Resolves immediately when the keyboard is already hidden (no-op path).
 */
export const waitForKeyboardDismiss = (): Promise<void> => {
  if (!Keyboard.isVisible()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      sub.remove();
      resolve();
    });
    Keyboard.dismiss();
  });
};

export interface BottomSheetMaxHeightOptions {
  headerHeightPx: number;
  sheetMaxHeightRatio?: number;
  topPaddingPx?: number;
  bottomPaddingPx?: number;
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
  } = options;

  const windowHeight = Dimensions.get("window").height;

  const availableHeight =
    windowHeight * sheetMaxHeightRatio - headerHeightPx - topPaddingPx;

  const maxHeight = Math.max(0, availableHeight - bottomPaddingPx);

  return maxHeight;
};
