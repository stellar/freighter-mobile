import { pxValue } from "helpers/dimensions";

/** How far below the bar the scroll cue comes to rest when tapped. */
const CUE_REST_BELOW_BAR = 60;

/**
 * The scroll offset that brings the cue to rest just below the bar, so the
 * tokens under it fill the screen.
 *
 * @param cueY The cue's y in the scroll content.
 * @param barBottom The bar's bottom edge, measured from the top of the screen.
 */
export const getScrollCueTargetY = (cueY: number, barBottom: number): number =>
  Math.max(0, cueY - barBottom - pxValue(CUE_REST_BELOW_BAR));
