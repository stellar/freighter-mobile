import { pxValue } from "helpers/dimensions";

// The floating tab bar's layout, from Figma's Tab Bar Buttons
// (?node-id=3487-68630): a 227×64 pill holding three 77×56 targets that
// overlap by 8, inset 6pt from the pill's ends and 4pt from its top and
// bottom. The selection capsule is a target's size.
//
// Sizes are design points, which callers scale with `pxValue`, except where
// a function says otherwise.

export const TAB_BAR_PILL_HEIGHT = 64;
export const TAB_TARGET_WIDTH = 77;
export const TAB_TARGET_HEIGHT = 56;
/** From one target's left edge to the next. */
export const TAB_TARGET_STEP = 69;
/** From the pill's ends to its first and last targets. */
export const TAB_PILL_END_INSET = 6;
/** From the pill's top and bottom to its targets. */
export const TAB_PILL_VERTICAL_INSET = 4;
export const TAB_ICON_SIZE = 28;

/** How far the pill's bottom edge sits above the bottom safe-area inset. */
const PILL_GAP_ABOVE_INSET = 6;
/** The pill's least distance from the screen's bottom edge. */
const PILL_MIN_BOTTOM_OFFSET = 16;
/** The space between the end of a screen's content and the pill's top. */
const CONTENT_GAP_ABOVE_PILL = 16;

/**
 * The pill's width for `tabCount` tabs. Discover sits behind a remote flag,
 * so there may be two tabs: the pill then shrinks to fit, with the same ends
 * and overlap.
 */
export const getPillWidth = (tabCount: number): number =>
  2 * TAB_PILL_END_INSET + TAB_TARGET_WIDTH + TAB_TARGET_STEP * (tabCount - 1);

/** The left edge of the target (and the selection) for the tab at `index`. */
export const getTabTargetLeft = (index: number): number =>
  TAB_PILL_END_INSET + TAB_TARGET_STEP * index;

/**
 * The pill's distance from the screen's bottom edge: 6pt above the bottom
 * inset, and at least 16pt where there's none (iPhone SE). It clears system
 * UI, so it's in points and isn't scaled.
 */
export const getPillBottomOffset = (bottomInset: number): number =>
  Math.max(bottomInset + PILL_GAP_ABOVE_INSET, PILL_MIN_BOTTOM_OFFSET);

/**
 * The pill's top edge, measured up from the screen's bottom edge, in points,
 * already scaled. Discover ends its column and its tab overview here: the
 * bottom padding of the search bar and of the overview's footer is the gap
 * above the pill.
 */
export const getFloatingTabBarTop = (bottomInset: number): number =>
  getPillBottomOffset(bottomInset) + pxValue(TAB_BAR_PILL_HEIGHT);

/**
 * How far above the screen's bottom edge a tab screen's content must end to
 * clear the pill with a 16pt gap, in points, already scaled.
 */
export const getFloatingTabBarClearance = (bottomInset: number): number =>
  getFloatingTabBarTop(bottomInset) + pxValue(CONTENT_GAP_ABOVE_PILL);
